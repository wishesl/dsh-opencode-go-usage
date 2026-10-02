/**
 * Shared types for @sutong12/dsh-opencode-go-usage.
 *
 * Usage comes from the OpenCode Go JSON API — `GET {baseUrl}/usage` with the
 * account API key, the same endpoint dsh-opencode-go reads — so no browser
 * session cookie is involved anywhere: the Host resolves the key, calls the
 * endpoint and hands the browser percentages plus absolute reset instants.
 * @module @sutong12/dsh-opencode-go-usage/types
 */
/** One of the three OpenCode Go usage windows. */
export type UsageWindowKind = 'rolling' | 'weekly' | 'monthly';
/** Whether the window is still usable or the account is rate-limited. */
export type UsageStatus = 'ok' | 'rate-limited';
/**
 * When the composer chip renders.
 *
 * - `always` — whenever a credential is configured, whichever model is on
 *   screen: the usage belongs to the account, not to the current model;
 * - `provider` — only while the current model selection runs on
 *   `opencode-go`, so another provider's user never sees these numbers;
 * - `never` — the chip stays out of the composer; the settings page remains
 *   the surface for reading and configuring.
 */
export type ChipVisibility = 'always' | 'provider' | 'never';
/** One usage window: percent used + the instant it resets. */
export interface UsageWindow {
    /** Window identity. */
    readonly kind: UsageWindowKind;
    /** 0–100 percent reported by the gateway. */
    readonly percent: number;
    /** ISO-8601 instant the window resets (the API's `resetsAt`). */
    readonly resetsAt: string;
    /** `rate-limited` when the window is exhausted. */
    readonly status: UsageStatus;
}
/** Normalized usage shape shared by every fetch path. */
export interface NormalizedUsage {
    /** Epoch ms of the last successful fetch (data freshness). */
    readonly updatedAt: number;
    /** Any window may be missing (new account, no Go subscription). */
    readonly rolling?: UsageWindow;
    readonly weekly?: UsageWindow;
    readonly monthly?: UsageWindow;
}
/** Fully resolved plugin configuration (env + config file + defaults). */
export interface OcgoConfig {
    /**
     * Literal API key configured locally, from this plugin's environment
     * variables or `$DSH_HOME/ocgo-usage.json`. When absent the Host falls back
     * to the DSH credentials seam (see {@link OcgoConfig.apiKeyRefs}).
     */
    readonly apiKey?: string;
    /** Credential references tried, in order, through the DSH credentials seam. */
    readonly apiKeyRefs: readonly string[];
    /** API base URL; `/usage` is appended. */
    readonly baseUrl: string;
    /** Cache TTL in seconds, clamped to [60, 3600]. */
    readonly cacheTTL: number;
    /** HTTP timeout in milliseconds. */
    readonly timeoutMs: number;
    /** When the composer chip renders. */
    readonly visibility: ChipVisibility;
}
/** One window serialized for the browser (no session identity). */
export type UsageWindowView = UsageWindow;
/** The browser-facing snapshot served by the host JSON endpoint. */
export interface OcgoUsageView {
    /** Epoch ms of the last successful fetch (absent before any success). */
    readonly updatedAt?: number;
    readonly rolling?: UsageWindowView;
    readonly weekly?: UsageWindowView;
    readonly monthly?: UsageWindowView;
    /** Machine-readable error code, present only on failure. */
    readonly error?: string;
    /**
     * The latest access failed transiently (timeout, network drop or a 5xx), so
     * these are the WINDOWS OF THE PREVIOUS SUCCESSFUL ROUND rather than a fresh
     * read — `updatedAt` still stamps that older fetch. Absent on a fresh read.
     * A transient failure never replaces the numbers with an error view: the
     * chip and the settings page keep showing what the last round produced.
     */
    readonly stale?: boolean;
    /** Human-readable failure detail (never contains the key). */
    readonly message?: string;
    /** Which source supplied the key for this read (never the value itself). */
    readonly keySource?: string;
    /**
     * The visibility mode in force. The browser applies it to its own live model
     * selection (see `provider.ts`), so the gate never waits for a poll.
     */
    readonly visibility?: ChipVisibility;
}
/** One masked secret field for the browser config editor (never the full value). */
export interface MaskedSecret {
    /** Whether a value is currently set. */
    readonly set: boolean;
    /** The last 4 characters of the value (full value when ≤ 4 chars). */
    readonly tail: string;
}
/** The browser-facing config view: which credential is set, masked, and from where. */
export interface MaskedConfigView {
    /** The effective API key, masked. */
    readonly apiKey: MaskedSecret;
    /**
     * Supplying source of the effective key: `environment`, `config`, or the
     * credentials seam (`credentials:<source>`). Never the value.
     */
    readonly source?: string;
    /** When the composer chip renders. */
    readonly visibility: ChipVisibility;
}
//# sourceMappingURL=types.d.ts.map