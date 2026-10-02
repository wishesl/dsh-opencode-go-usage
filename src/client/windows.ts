/**
 * Usage-window presentation shared by the composer chip and the settings page:
 * the short and full window labels, the compact duration formatter, the
 * fetch-time clock, and the severity→class ramp. Split out so both surfaces
 * format and colour the same numbers identically.
 * @module @sutong12/dsh-opencode-go-usage/client/windows
 */

import type { UsageWindow, UsageWindowKind } from '../types.ts'
import type { OcgoKey } from './locales.ts'
import css from './ocgo.module.css'

/** Short window label for the inline chip: 5h / wk / mo. */
export const WINDOW_LABELS: Record<UsageWindowKind, string> = {
  rolling: '5h',
  weekly: 'wk',
  monthly: 'mo',
}

/** Full window label key for the detail panel and the settings page. */
export const WINDOW_TITLE_KEYS: Record<UsageWindowKind, OcgoKey> = {
  rolling: 'ocgo.rolling',
  weekly: 'ocgo.weekly',
  monthly: 'ocgo.monthly',
}

/**
 * Seconds until a window resets, clamped at 0 for a reset instant already past.
 * The API reports an absolute `resetsAt`, so the countdown is derived at render
 * time instead of being read from the payload.
 * @param window - the usage window.
 * @returns whole seconds remaining.
 */
export function resetInSec(window: UsageWindow): number {
  const at = Date.parse(window.resetsAt)
  if (!Number.isFinite(at)) return 0
  return Math.max(0, Math.round((at - Date.now()) / 1000))
}

/**
 * Format a duration (seconds) compactly: 45s / 23m / 5h 23m / 4d 6h.
 * @param totalSec - seconds until a window resets.
 * @returns the compact human duration.
 */
export function formatDuration(totalSec: number): string {
  if (totalSec < 60) return `${Math.max(0, Math.floor(totalSec))}s`
  if (totalSec < 3600) return `${Math.floor(totalSec / 60)}m`
  if (totalSec < 86400) {
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  return h > 0 ? `${d}d ${h}h` : `${d}d`
}

/**
 * Format an epoch-ms time as a local HH:MM clock.
 * @param epochMs - epoch milliseconds.
 * @returns the `HH:MM` text.
 */
export function formatClock(epochMs: number): string {
  const d = new Date(epochMs)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * The severity class of one window (muted → escalating warn → err).
 * @param window - the usage window to classify.
 * @returns the CSS-module class name, or undefined below the first threshold.
 */
export function severityClass(window: UsageWindow): string | undefined {
  if (window.status === 'rate-limited' || window.percent >= 90) return css.segCrit90
  if (window.percent >= 80) return css.segErr80
  if (window.percent >= 70) return css.segWarn70
  if (window.percent >= 60) return css.segWarn60
  if (window.percent >= 50) return css.segWarn50
  return undefined
}
