/**
 * Visibility-mode tests: the three settings options, their persistence, the pure
 * gate the composer chip applies to its own live model selection, and the mode
 * the Host reports in place of a verdict.
 * @module @sutong12/dsh-opencode-go-usage/visibility.test
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
import { chipVisible, isOpenCodeGo } from './provider.ts'
import { OcgoUsageService, type OcgoUsageServiceOptions } from './service.ts'

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

describe('chipVisible', () => {
  it('always mode shows whichever provider is selected', () => {
    expect(chipVisible('always', 'opencode-go')).toBe(true)
    expect(chipVisible('always', 'deepseek-account')).toBe(true)
    expect(chipVisible('always', undefined)).toBe(true)
  })

  it('provider mode follows the live model selection', () => {
    expect(chipVisible('provider', 'opencode-go')).toBe(true)
    expect(chipVisible('provider', 'opencode-go/variant')).toBe(true)
    expect(chipVisible('provider', 'deepseek-account')).toBe(false)
  })

  it('provider mode fails OPEN while the provider is unknown', () => {
    // The earlier revision hid the chip whenever its probe answered nothing,
    // which is how it disappeared unconditionally on DSH 0.2.0.
    expect(chipVisible('provider', undefined)).toBe(true)
  })

  it('never mode hides the chip whatever the selection', () => {
    expect(chipVisible('never', 'opencode-go')).toBe(false)
    expect(chipVisible('never', undefined)).toBe(false)
  })
})

describe('isOpenCodeGo', () => {
  it('accepts the provider id and its slashed variants only', () => {
    expect(isOpenCodeGo('opencode-go')).toBe(true)
    expect(isOpenCodeGo('opencode-go/some-model')).toBe(true)
    expect(isOpenCodeGo('opencode')).toBe(false)
    expect(isOpenCodeGo('deepseek-account')).toBe(false)
    expect(isOpenCodeGo(undefined)).toBe(false)
  })
})

describe('the Host reports the mode, not a verdict', () => {
  let tmp: string
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of [ENV_API_KEY, ENV_VISIBILITY, 'DSH_HOME']) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
    process.env[ENV_API_KEY] = 'sk-test-key'
    tmp = mkdtempSync(join(tmpdir(), 'dsh-ocgo-vis-mode-'))
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

  it('carries the mode on the usage view and never a showChip verdict', async () => {
    process.env[ENV_VISIBILITY] = 'provider'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(OK_BODY, { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const view = await makeService().view()
    expect(view.visibility).toBe('provider')
    expect(view.showChip).toBeUndefined()
    expect(view.rolling?.percent).toBe(3)
  })

  it('carries the mode to the settings page', async () => {
    process.env[ENV_VISIBILITY] = 'never'
    const masked = await makeService({ resolveCredential: async () => undefined }).maskedConfig()
    expect(masked.visibility).toBe('never')
  })
})

describe('a visibility write does not re-query the gateway', () => {
  let tmp: string
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of [ENV_API_KEY, ENV_VISIBILITY, 'DSH_HOME']) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
    process.env[ENV_API_KEY] = 'sk-test-key'
    tmp = mkdtempSync(join(tmpdir(), 'dsh-ocgo-vis-write-'))
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

  it('serves the new mode from the cache, and only a credential write refetches', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(OK_BODY, { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const service = makeService()

    await service.view() // one gateway read
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect((await service.view()).visibility).toBe('always')

    // The user switches the display mode in Settings.
    writeConfigFile({ visibility: 'never' })
    service.noteConfigWrite({ apiKey: false })
    const afterMode = await service.view()
    // The mode is live immediately, and it cost no gateway round trip — that
    // refetch is what made a mode switch feel laggy.
    expect(afterMode.visibility).toBe('never')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // A credential write still starts from a clean slate.
    writeConfigFile({ apiKey: 'sk-rotated' })
    service.noteConfigWrite({ apiKey: true })
    await service.view()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
