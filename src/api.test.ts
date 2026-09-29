/**
 * Unit tests for the usage API client (the JSON endpoint path).
 * @module dsh-ocgo-usage/api.test
 */

import { describe, expect, it, vi } from 'vitest'
import { fetchViaApi, parseUsage, UsageError } from './api.ts'
import type { OcgoConfig } from './types.ts'

const CFG: OcgoConfig = {
  apiKeyRefs: ['OPENCODE_GO_API_KEY'],
  baseUrl: 'https://opencode.ai/zen/go/v1',
  cacheTTL: 300,
  timeoutMs: 10_000,
}

/** One window object as the endpoint renders it. */
function window(status: string, percent: unknown, resetsAt: unknown): Record<string, unknown> {
  return { status, percent, resetsAt }
}

describe('parseUsage', () => {
  it('normalizes all three windows from the live payload shape', () => {
    const parsed = parseUsage({
      rolling: window('ok', 0, '2026-09-29T21:48:13.667Z'),
      weekly: window('ok', 6, '2026-10-05T00:00:00.000Z'),
      monthly: window('rate-limited', 100, '2026-10-26T08:20:09.000Z'),
    })
    expect(parsed.rolling).toEqual({
      kind: 'rolling',
      percent: 0,
      resetsAt: '2026-09-29T21:48:13.667Z',
      status: 'ok',
    })
    expect(parsed.weekly?.percent).toBe(6)
    expect(parsed.monthly?.status).toBe('rate-limited')
  })

  it('accepts a subset of windows', () => {
    const parsed = parseUsage({ weekly: window('ok', 12, '2026-10-05T00:00:00.000Z') })
    expect(parsed.weekly?.kind).toBe('weekly')
    expect(parsed.rolling).toBeUndefined()
    expect(parsed.monthly).toBeUndefined()
  })

  it('rejects a missing payload', () => {
    expect(() => parseUsage(undefined)).toThrow(UsageError)
    expect(() => parseUsage(null)).toThrow(UsageError)
    expect(() => parseUsage('usage')).toThrow(UsageError)
  })

  it('rejects a payload carrying no windows at all', () => {
    expect(() => parseUsage({})).toThrow(/no usage windows/)
  })

  it('rejects an unknown status', () => {
    expect(() => parseUsage({ rolling: window('exhausted', 100, '2026-10-05T00:00:00.000Z') }))
      .toThrow(/Invalid "rolling" window/)
  })

  it('rejects a resetsAt that is not a parseable instant', () => {
    expect(() => parseUsage({ rolling: window('ok', 5, 'not-a-date') })).toThrow(UsageError)
    expect(() => parseUsage({ rolling: window('ok', 5, 123) })).toThrow(UsageError)
  })

  it('rejects a negative or non-finite percent', () => {
    expect(() => parseUsage({ rolling: window('ok', -1, '2026-10-05T00:00:00.000Z') })).toThrow(UsageError)
    expect(() => parseUsage({ rolling: window('ok', Number.NaN, '2026-10-05T00:00:00.000Z') })).toThrow(UsageError)
  })

  it('clamps a percent above 100', () => {
    const parsed = parseUsage({ rolling: window('rate-limited', 140, '2026-10-05T00:00:00.000Z') })
    expect(parsed.rolling?.percent).toBe(100)
  })
})

describe('fetchViaApi', () => {
  it('reads the usage payload from the JSON endpoint with a bearer key', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ usage: { rolling: window('ok', 23, '2026-09-29T21:48:13.667Z') } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const parsed = await fetchViaApi(CFG, 'sk-secret')
    expect(parsed.rolling?.percent).toBe(23)
    const [url, init] = fetchSpy.mock.calls[0] ?? []
    expect(String(url)).toBe('https://opencode.ai/zen/go/v1/usage')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-secret')
  })

  it('maps a rejected key to an http<status> code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 401 }))
    await expect(fetchViaApi(CFG, 'sk-bad')).rejects.toMatchObject({ code: 'http401' })
  })

  it('maps a transport abort to a timeout code', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    )
    await expect(fetchViaApi(CFG, 'sk-x')).rejects.toMatchObject({ code: 'timeout' })
  })

  it('maps a non-JSON body to an invalid code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    )
    await expect(fetchViaApi(CFG, 'sk-x')).rejects.toMatchObject({ code: 'invalid' })
  })
})
