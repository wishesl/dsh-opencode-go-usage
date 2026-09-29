/**
 * Unit tests for the cached usage service.
 * @module dsh-ocgo-usage/service.test
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ENV_API_KEY, ENV_API_KEY_ALT } from './config.ts'
import { OcgoUsageService } from './service.ts'

const SAVED_KEY = process.env[ENV_API_KEY]
const SAVED_KEY_ALT = process.env[ENV_API_KEY_ALT]
const SAVED_HOME = process.env.DSH_HOME

/** The live endpoint's response shape. */
const OK_BODY = JSON.stringify({
  usage: {
    rolling: { status: 'ok', percent: 23, resetsAt: '2026-09-29T21:48:13.667Z' },
    weekly: { status: 'ok', percent: 6, resetsAt: '2026-10-05T00:00:00.000Z' },
    monthly: { status: 'rate-limited', percent: 100, resetsAt: '2026-10-26T08:20:09.000Z' },
  },
})

/** A 200 JSON response carrying {@link OK_BODY}. */
function okResponse(): Response {
  return new Response(OK_BODY, { status: 200, headers: { 'content-type': 'application/json' } })
}

describe('OcgoUsageService', () => {
  let ctx: Context
  let tmp: string

  beforeEach(() => {
    process.env[ENV_API_KEY] = 'sk-test-key'
    delete process.env[ENV_API_KEY_ALT]
    tmp = mkdtempSync(join(tmpdir(), 'dsh-ocgo-usage-svc-'))
    process.env.DSH_HOME = tmp
    ctx = new Context()
  })

  afterEach(() => {
    // Restore mocks FIRST so a failure below cannot leak state into the next
    // test. Cordis 4 exposes no public Context.dispose, and the service owns no
    // timers/subscriptions, so the test context is left for the worker to
    // reclaim.
    vi.restoreAllMocks()
    if (SAVED_KEY === undefined) delete process.env[ENV_API_KEY]
    else process.env[ENV_API_KEY] = SAVED_KEY
    if (SAVED_KEY_ALT === undefined) delete process.env[ENV_API_KEY_ALT]
    else process.env[ENV_API_KEY_ALT] = SAVED_KEY_ALT
    if (SAVED_HOME === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = SAVED_HOME
    rmSync(tmp, { recursive: true, force: true })
  })

  it('returns the parsed windows and the key source on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const service = new OcgoUsageService(ctx)
    const view = await service.view()
    expect(view.error).toBeUndefined()
    expect(view.rolling).toEqual({
      kind: 'rolling',
      percent: 23,
      resetsAt: '2026-09-29T21:48:13.667Z',
      status: 'ok',
    })
    expect(view.monthly?.status).toBe('rate-limited')
    expect(view.keySource).toBe('environment')
    expect(view.updatedAt).toBeTypeOf('number')
  })

  it('calls {baseUrl}/usage with the bearer key', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    await new OcgoUsageService(ctx).view()
    const [url, init] = fetchSpy.mock.calls[0] ?? []
    expect(String(url)).toBe('https://opencode.ai/zen/go/v1/usage')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test-key')
  })

  it('falls back to the DSH credentials seam when nothing is configured locally', async () => {
    delete process.env[ENV_API_KEY]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const resolveCredential = vi.fn(async (ref: string) =>
      ref === ENV_API_KEY_ALT ? { value: 'sk-from-store', source: 'store' } : undefined)
    const view = await new OcgoUsageService(ctx, {}, { resolveCredential }).view()
    expect(view.error).toBeUndefined()
    expect(view.keySource).toBe('credentials:store')
    expect(view.rolling?.percent).toBe(23)
    expect(resolveCredential).toHaveBeenCalledWith(ENV_API_KEY)
    expect(resolveCredential).toHaveBeenCalledWith(ENV_API_KEY_ALT)
  })

  it('returns noconfig when neither local config nor the seam supplies a key', async () => {
    delete process.env[ENV_API_KEY]
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const view = await new OcgoUsageService(ctx, {}, { resolveCredential: async () => undefined }).view()
    expect(view.error).toBe('noconfig')
    expect(view.message).toMatch(/API key/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('deduplicates concurrent view() calls into one fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const service = new OcgoUsageService(ctx)
    const [a, b] = await Promise.all([service.view(), service.view()])
    expect(a.rolling?.percent).toBe(23)
    expect(b.rolling?.percent).toBe(23)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('serves the cached view within the TTL without refetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const service = new OcgoUsageService(ctx)
    await service.view()
    await service.view()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('maps an HTTP failure to an http<status> code and enters cooldown', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }))
    const service = new OcgoUsageService(ctx)
    expect((await service.view()).error).toBe('http500')
    // Cooldown: the second call reuses the error without fetching again.
    expect((await service.view()).error).toBe('http500')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('refresh() bypasses the cache window', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const service = new OcgoUsageService(ctx)
    await service.view()
    await service.refresh()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('answers disabled when the plugin is switched off', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const view = await new OcgoUsageService(ctx, { enabled: false }).view()
    expect(view.error).toBe('disabled')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('masks the effective key and reports the layer that supplied it', async () => {
    const masked = await new OcgoUsageService(ctx, {}, { resolveCredential: async () => undefined }).maskedConfig()
    expect(masked.apiKey).toEqual({ set: true, tail: '-key' })
    expect(masked.source).toBe('environment')
  })

  it('reports an unset key without a source', async () => {
    delete process.env[ENV_API_KEY]
    const masked = await new OcgoUsageService(ctx, {}, { resolveCredential: async () => undefined }).maskedConfig()
    expect(masked.apiKey).toEqual({ set: false, tail: '' })
    expect(masked.source).toBeUndefined()
  })
})
