/**
 * HTTP fetch + response adapter for @sutong12/dsh-opencode-go-usage.
 *
 * Source of truth: the OpenCode Go account statistics endpoint
 * `GET {baseUrl}/usage`, authenticated with `Authorization: Bearer <apiKey>` —
 * the same endpoint dsh-opencode-go reads. It answers
 * `{ usage: { rolling: {...}, weekly: {...}, monthly: {...} } }`, each window
 * `{ status, percent, resetsAt }` with `resetsAt` an absolute ISO-8601 instant.
 *
 * This replaces the earlier cookie-authenticated SSR scrape of
 * `/workspace/<wrk>/go`: the API needs no browser session, returns structured
 * data instead of locale-dependent HTML, and reports resets as instants rather
 * than as phrases that had to be parsed per language.
 * @module @sutong12/dsh-opencode-go-usage/api
 */

import type { NormalizedUsage, OcgoConfig, UsageWindow, UsageWindowKind, UsageStatus } from './types.ts'

// ============================================================================
// Errors
// ============================================================================

/** Error thrown by the HTTP / parsing layer; carries a short code for the UI. */
export class UsageError extends Error {
  override readonly name = 'UsageError'
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
  }
}

/** The three windows the endpoint reports. */
const WINDOW_KINDS: readonly UsageWindowKind[] = ['rolling', 'weekly', 'monthly']

// ============================================================================
// Response adapter
// ============================================================================

/** Build the shape error for one window. */
function invalidWindow(kind: UsageWindowKind): UsageError {
  return new UsageError(`Invalid "${kind}" window in the usage response`, 'invalid')
}

/**
 * Validate one window object from the `usage` payload.
 * @param kind - window identity to stamp onto the result.
 * @param row - the raw window value.
 * @returns the normalized window.
 * @throws UsageError with code `invalid` when any field is missing or malformed.
 */
function parseWindow(kind: UsageWindowKind, row: unknown): UsageWindow {
  if (row === undefined || row === null || typeof row !== 'object') {
    throw invalidWindow(kind)
  }
  const w = row as Record<string, unknown>
  const status = w.status
  const percent = w.percent
  const resetsAt = w.resetsAt
  if (
    (status !== 'ok' && status !== 'rate-limited')
    || typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0
    || typeof resetsAt !== 'string' || !Number.isFinite(Date.parse(resetsAt))
  ) {
    throw invalidWindow(kind)
  }
  return { kind, percent: clampPercent(percent), resetsAt, status }
}

/**
 * Parse the `usage` object of the endpoint response. Windows that are absent
 * are omitted; a window present but malformed fails the whole read rather than
 * silently reporting zero.
 * @param value - the `usage` value taken from the response body.
 * @returns the normalized windows, stamped with an `updatedAt` by the caller.
 * @throws UsageError with code `invalid`.
 */
export function parseUsage(value: unknown): Omit<NormalizedUsage, 'updatedAt'> {
  if (value === undefined || value === null || typeof value !== 'object') {
    throw new UsageError('The usage endpoint returned no usage payload', 'invalid')
  }
  const source = value as Record<string, unknown>
  const result: Record<string, UsageWindow> = {}
  let found = 0
  for (const kind of WINDOW_KINDS) {
    const row = source[kind]
    if (row === undefined || row === null) continue
    result[kind] = parseWindow(kind, row)
    found += 1
  }
  if (found === 0) {
    throw new UsageError('The usage response carries no usage windows', 'invalid')
  }
  return result as Omit<NormalizedUsage, 'updatedAt'>
}

// ============================================================================
// HTTP
// ============================================================================

/** Strip query params from a URL for safe error messages. */
function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}${u.pathname}`
  } catch {
    return url
  }
}

/**
 * Fetch usage from the account statistics endpoint.
 * @param cfg - resolved plugin configuration.
 * @param apiKey - the bearer key (never logged).
 * @returns the normalized windows.
 * @throws UsageError on transport, HTTP-status or shape failure.
 */
export async function fetchViaApi(
  cfg: OcgoConfig,
  apiKey: string,
): Promise<Omit<NormalizedUsage, 'updatedAt'>> {
  const url = `${cfg.baseUrl}/usage`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: controller.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new UsageError(`Request timed out after ${cfg.timeoutMs}ms`, 'timeout')
    }
    throw new UsageError(String(e instanceof Error ? e.message : e), 'fetch')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    throw new UsageError(`HTTP ${res.status} for ${sanitizeUrl(url)}`, `http${res.status}`)
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new UsageError('The usage endpoint returned invalid JSON', 'invalid')
  }
  const usage = body !== null && typeof body === 'object'
    ? (body as { usage?: unknown }).usage
    : undefined
  return parseUsage(usage)
}

/**
 * Fetch usage with the current config and stamp the fetch timestamp so the UI
 * can report data freshness.
 * @param cfg - resolved plugin configuration.
 * @param apiKey - the bearer key.
 * @returns the normalized usage including `updatedAt`.
 */
export async function fetchUsage(cfg: OcgoConfig, apiKey: string): Promise<NormalizedUsage> {
  const data = await fetchViaApi(cfg, apiKey)
  return { ...data, updatedAt: Date.now() }
}

// ============================================================================
// Internal helpers
// ============================================================================

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.floor(n)))
}

/** Re-exported for callers that only need the status union. */
export type { UsageStatus }
