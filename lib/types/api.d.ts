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
import type { NormalizedUsage, OcgoConfig, UsageStatus } from './types.ts';
/** Error thrown by the HTTP / parsing layer; carries a short code for the UI. */
export declare class UsageError extends Error {
    readonly code: string;
    readonly name = "UsageError";
    constructor(message: string, code: string);
}
/**
 * Parse the `usage` object of the endpoint response. Windows that are absent
 * are omitted; a window present but malformed fails the whole read rather than
 * silently reporting zero.
 * @param value - the `usage` value taken from the response body.
 * @returns the normalized windows, stamped with an `updatedAt` by the caller.
 * @throws UsageError with code `invalid`.
 */
export declare function parseUsage(value: unknown): Omit<NormalizedUsage, 'updatedAt'>;
/**
 * Fetch usage from the account statistics endpoint.
 * @param cfg - resolved plugin configuration.
 * @param apiKey - the bearer key (never logged).
 * @returns the normalized windows.
 * @throws UsageError on transport, HTTP-status or shape failure.
 */
export declare function fetchViaApi(cfg: OcgoConfig, apiKey: string): Promise<Omit<NormalizedUsage, 'updatedAt'>>;
/**
 * Fetch usage with the current config and stamp the fetch timestamp so the UI
 * can report data freshness.
 * @param cfg - resolved plugin configuration.
 * @param apiKey - the bearer key.
 * @returns the normalized usage including `updatedAt`.
 */
export declare function fetchUsage(cfg: OcgoConfig, apiKey: string): Promise<NormalizedUsage>;
/** Re-exported for callers that only need the status union. */
export type { UsageStatus };
//# sourceMappingURL=api.d.ts.map