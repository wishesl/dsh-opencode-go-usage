/**
 * Unit tests for the configuration loader.
 * @module @sutong12/dsh-opencode-go-usage/config.test
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_BASE_URL,
  DEFAULT_CACHE_TTL,
  DEFAULT_TIMEOUT_MS,
  ENV_API_KEY,
  ENV_API_KEY_ALT,
  ENV_BASE_URL,
  ENV_CACHE_TTL,
  ENV_TIMEOUT_MS,
  configFilePath,
  loadConfig,
  loadLocalApiKey,
  maskSecret,
  writeConfigFile,
} from './config.ts'

const ENV_KEYS = [ENV_API_KEY, ENV_API_KEY_ALT, ENV_BASE_URL, ENV_CACHE_TTL, ENV_TIMEOUT_MS, 'DSH_HOME']

/** Clear every env var the config reads, remembering the previous values. */
function clearEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {}
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  return saved
}

/** Restore the values captured by {@link clearEnv}. */
function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
}

describe('config', () => {
  let tmp: string
  let savedEnv: Record<string, string | undefined>

  beforeEach(() => {
    savedEnv = clearEnv()
    tmp = mkdtempSync(join(tmpdir(), 'dsh-opencode-go-usage-cfg-'))
    process.env.DSH_HOME = tmp
  })

  afterEach(() => {
    restoreEnv(savedEnv)
    rmSync(tmp, { recursive: true, force: true })
  })

  describe('loadConfig', () => {
    it('defaults to the OpenCode Go gateway base URL', () => {
      const cfg = loadConfig()
      expect(DEFAULT_BASE_URL).toBe('https://opencode.ai/zen/go/v1')
      expect(cfg.baseUrl).toBe(DEFAULT_BASE_URL)
      expect(cfg.cacheTTL).toBe(DEFAULT_CACHE_TTL)
      expect(cfg.timeoutMs).toBe(DEFAULT_TIMEOUT_MS)
      expect(cfg.apiKey).toBeUndefined()
    })

    it('prefers OPENCODE_GO_API_KEY, then OPENCODE_API_KEY', () => {
      process.env[ENV_API_KEY_ALT] = 'sk-alt'
      expect(loadConfig().apiKey).toBe('sk-alt')
      process.env[ENV_API_KEY] = 'sk-primary'
      expect(loadConfig().apiKey).toBe('sk-primary')
    })

    it('reads the key and overrides from the config file', () => {
      writeFileSync(configFilePath(), JSON.stringify({
        apiKey: 'sk-file',
        baseUrl: 'https://example.test/v1/',
        cacheTTL: 900,
        timeoutMs: 2500,
      }))
      const cfg = loadConfig()
      expect(cfg.apiKey).toBe('sk-file')
      // A trailing slash is trimmed so `/usage` never doubles up.
      expect(cfg.baseUrl).toBe('https://example.test/v1')
      expect(cfg.cacheTTL).toBe(900)
      expect(cfg.timeoutMs).toBe(2500)
    })

    it('clamps cacheTTL into [60, 3600]', () => {
      process.env[ENV_CACHE_TTL] = '5'
      expect(loadConfig().cacheTTL).toBe(60)
      process.env[ENV_CACHE_TTL] = '99999'
      expect(loadConfig().cacheTTL).toBe(3600)
    })

    it('survives an unparseable config file', () => {
      writeFileSync(configFilePath(), '{ not json')
      expect(loadConfig().apiKey).toBeUndefined()
      expect(loadConfig().baseUrl).toBe(DEFAULT_BASE_URL)
    })
  })

  describe('loadLocalApiKey', () => {
    it('reports the environment as the source', () => {
      process.env[ENV_API_KEY] = 'sk-env'
      expect(loadLocalApiKey()).toEqual({ key: 'sk-env', source: 'environment' })
    })

    it('reports the config file as the source', () => {
      writeFileSync(configFilePath(), JSON.stringify({ apiKey: 'sk-file' }))
      expect(loadLocalApiKey()).toEqual({ key: 'sk-file', source: 'config' })
    })

    it('prefers the environment over the config file', () => {
      writeFileSync(configFilePath(), JSON.stringify({ apiKey: 'sk-file' }))
      process.env[ENV_API_KEY] = 'sk-env'
      expect(loadLocalApiKey()?.source).toBe('environment')
    })

    it('answers undefined when nothing local is set', () => {
      expect(loadLocalApiKey()).toBeUndefined()
    })
  })

  describe('maskSecret', () => {
    it('keeps only the last four characters', () => {
      expect(maskSecret('sk-abcdefgh')).toEqual({ set: true, tail: 'efgh' })
    })

    it('returns the whole value when it is four characters or fewer', () => {
      expect(maskSecret('abcd')).toEqual({ set: true, tail: 'abcd' })
    })

    it('reports an unset secret', () => {
      expect(maskSecret(undefined)).toEqual({ set: false, tail: '' })
      expect(maskSecret('')).toEqual({ set: false, tail: '' })
    })
  })

  describe('writeConfigFile', () => {
    it('stores the key, preserves other fields, and returns the stored value', () => {
      writeFileSync(configFilePath(), JSON.stringify({ baseUrl: 'https://example.test/v1' }))
      expect(writeConfigFile({ apiKey: '  sk-new  ' })).toBe('sk-new')
      const onDisk = JSON.parse(readFileSync(configFilePath(), 'utf8')) as Record<string, unknown>
      expect(onDisk.apiKey).toBe('sk-new')
      expect(onDisk.baseUrl).toBe('https://example.test/v1')
    })

    it('leaves the key untouched when the field is absent', () => {
      writeFileSync(configFilePath(), JSON.stringify({ apiKey: 'sk-keep' }))
      expect(writeConfigFile({})).toBe('sk-keep')
    })

    it('clears the local override when passed null', () => {
      writeFileSync(configFilePath(), JSON.stringify({ apiKey: 'sk-keep', baseUrl: 'https://example.test/v1' }))
      expect(writeConfigFile({ apiKey: null })).toBeUndefined()
      const onDisk = JSON.parse(readFileSync(configFilePath(), 'utf8')) as Record<string, unknown>
      expect('apiKey' in onDisk).toBe(false)
      expect(onDisk.baseUrl).toBe('https://example.test/v1')
    })
  })
})
