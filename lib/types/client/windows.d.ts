/**
 * Usage-window presentation shared by the composer chip and the settings page:
 * the short and full window labels, the compact duration formatter, the
 * fetch-time clock, and the severity→class ramp. Split out so both surfaces
 * format and colour the same numbers identically.
 * @module dsh-ocgo-usage/client/windows
 */
import type { UsageWindow, UsageWindowKind } from '../types.ts';
import type { OcgoKey } from './locales.ts';
/** Short window label for the inline chip: 5h / wk / mo. */
export declare const WINDOW_LABELS: Record<UsageWindowKind, string>;
/** Full window label key for the detail panel and the settings page. */
export declare const WINDOW_TITLE_KEYS: Record<UsageWindowKind, OcgoKey>;
/**
 * Seconds until a window resets, clamped at 0 for a reset instant already past.
 * The API reports an absolute `resetsAt`, so the countdown is derived at render
 * time instead of being read from the payload.
 * @param window - the usage window.
 * @returns whole seconds remaining.
 */
export declare function resetInSec(window: UsageWindow): number;
/**
 * Format a duration (seconds) compactly: 45s / 23m / 5h 23m / 4d 6h.
 * @param totalSec - seconds until a window resets.
 * @returns the compact human duration.
 */
export declare function formatDuration(totalSec: number): string;
/**
 * Format an epoch-ms time as a local HH:MM clock.
 * @param epochMs - epoch milliseconds.
 * @returns the `HH:MM` text.
 */
export declare function formatClock(epochMs: number): string;
/**
 * The severity class of one window (muted → escalating warn → err).
 * @param window - the usage window to classify.
 * @returns the CSS-module class name, or undefined below the first threshold.
 */
export declare function severityClass(window: UsageWindow): string | undefined;
//# sourceMappingURL=windows.d.ts.map