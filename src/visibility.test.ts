/**
 * Visibility-mode tests: the three settings options, their persistence, and the
 * Host `showChip` decision the composer chip obeys.
 * @module dsh-ocgo-usage/visibility.test
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ENV_API_KEY,
  ENV_VISIBILITY,
  configFilePath,
  loadConfig,
  parseVisibility,
  writeConfigFile,
} from './config.ts'
import { OcgoUsageService, type OcgoUsageServiceOptions } from './service.ts'
import type { ChipVisibility } from './types.ts'

/** A minimal successful endpoint body. */
const OK_BODY = JSON.stringify({
  usage: { rolling: { status: 'ok', percent: 3, resetsAt: '2026-09-29T21:48:13.667Z' } },
})

/**
 * A service on its own fresh root context: `ocgoUsage` is a per-context service
 * key, so one test cannot mount two instances on the same context.
 * @param options - the host seams to inject.
 * @returns the mounted service.
 */
function makeService(options: OcgoUsageServiceOptions = {}): OcgoUsageService {
  return new OcgoUsageService(new Context(), {}, options)
}

/** Mock fetch with the live endpoint's shape. */
function mockOk(): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(OK_BODY, { status: 200, headers: { 'content-type': 'application/json' } }),
  )
}

describe('parseVisibility', () => {
  it('accepts the three modes', () => {
    expect(parseVisibility('always')).toBe('always')
    expect(parseVisibility('provider')).toBe('provider')
    expect(parseVisibility('never')).toBe('never')
  })

  it('falls back to always for anything unknown', () => {
    expect(parseVisibility(undefined)).toBe('always')
    expect(parseVisibility('sometimes')).toBe('always')
  })
})

describe('visibility persistence', () => {
  let tmp: string
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of [ENV_VISIBILITY, 'DSH_HOME']) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
    tmp = mkdtempSync(join(tmpdir(), 'dsh-ocgo-vis-'))
    process.env.DSH_HOME = tmp
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    rmSync(tmp, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('defaults to always and then reads the stored mode', () => {
    expect(loadConfig().visibility).toBe('always')
    writeConfigFile({ visibility: 'never' })
    expect(loadConfig().visibility).toBe('never')
    const onDisk = JSON.parse(readFileSync(configFilePath(), 'utf8')) as Record<string, unknown>
    expect(onDisk.visibility).toBe('never')
  })

  it('lets the environment override the file', () => {
    writeFileSync(configFilePath(), JSON.stringify({ visibility: 'never' }))
    process.env[ENV_VISIBILITY] = 'provider'
    expect(loadConfig().visibility).toBe('provider')
  })

  it('preserves the stored key when only the mode changes', () => {
    writeFileSync(configFilePath(), JSON.stringify({ apiKey: 'sk-keep' }))
    writeConfigFile({ visibility: 'provider' })
    const onDisk = JSON.parse(readFileSync(configFilePath(), 'utf8')) as Record<string, unknown>
    expect(onDisk.apiKey).toBe('sk-keep')
    expect(onDisk.visibility).toBe('provider')
  })
})

describe('showChip', () => {
  let tmp: string
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of [ENV_API_KEY, ENV_VISIBILITY, 'DSH_HOME']) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
    process.env[ENV_API_KEY] = 'sk-test-key'
    tmp = mkdtempSync(join(tmpdir(), 'dsh-ocgo-vis-chip-'))
    process.env.DSH_HOME = tmp
  })

  afterEach(() => {
    vi.restoreAllMocks()
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    rmSync(tmp, { recursive: true, force: true })
  })

  it('always mode shows whichever provider is selected', async () => {
    process.env[ENV_VISIBILITY] = 'always'
    mockOk()
    const view = await makeService({ currentProvider: () => 'deepseek-account' }).view()
    expect(view.visibility).toBe('always')
    expect(view.showChip).toBe(true)
  })

  it('provider mode follows the current model selection', async () => {
    process.env[ENV_VISIBILITY] = 'provider'
    mockOk()
    const onGo = await makeService({ currentProvider: () => 'opencode-go' }).view()
    expect(onGo.showChip).toBe(true)
    const off = await makeService({ currentProvider: () => 'deepseek-account' }).view()
    expect(off.showChip).toBe(false)
  })

  it('provider mode fails OPEN when the selection probe is unavailable', async () => {
    process.env[ENV_VISIBILITY] = 'provider'
    mockOk()
    // No currentProvider wired at all — the old revision hid the chip here.
    const view = await makeService().view()
    expect(view.showChip).toBe(true)
  })

  it('never mode hides the chip while still reading usage', async () => {
    process.env[ENV_VISIBILITY] = 'never'
    mockOk()
    const view = await makeService({ currentProvider: () => 'opencode-go' }).view()
    expect(view.showChip).toBe(false)
    expect(view.rolling?.percent).toBe(3)
  })

  it('hides an unconfigured install in every mode', async () => {
    delete process.env[ENV_API_KEY]
    for (const mode of ['always', 'provider', 'never'] as const satisfies readonly ChipVisibility[]) {
      process.env[ENV_VISIBILITY] = mode
      const view = await makeService({ resolveCredential: async () => undefined }).view()
      expect(view.error).toBe('noconfig')
      expect(view.showChip).toBe(false)
    }
  })

  it('reports the mode to the settings page', async () => {
    process.env[ENV_VISIBILITY] = 'never'
    const masked = await makeService({ resolveCredential: async () => undefined }).maskedConfig()
    expect(masked.visibility).toBe('never')
  })
})
