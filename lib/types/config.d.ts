/**
 * Configuration loader for dsh-ocgo-usage
 *
 * The credential is an OpenCode Go **API key** (the same key the model provider
 * uses), not a browser session cookie: usage is read from `GET {baseUrl}/usage`
 * with `Authorization: Bearer <key>`.
 *
 * Resolution order for the key:
 *   1. this plugin's environment variables (`OPENCODE_GO_API_KEY`, then
 *      `OPENCODE_API_KEY`) — the names double as credentials-seam references;
 *   2. `$DSH_HOME/ocgo-usage.json`;
 *   3. the DSH credentials seam (provider-managed store, then `.env`), applied
 *      by the service when neither of the above supplies a value — see
 *      `OcgoUsageService`.
 *
 * The key is NEVER logged.
 *
 * The browser config editor (`/api/ocgo-usage/config`) reads a MASKED view
 * (never the full key) and writes back through {@link writeConfigFile}.
 * @module dsh-ocgo-usage/config
 */
import type { ChipVisibility, MaskedSecret, OcgoConfig } from './types.ts';
/** Primary environment variable / credentials-seam reference. */
export declare const ENV_API_KEY = "OPENCODE_GO_API_KEY";
/** Secondary reference, the one dsh-opencode-go defaults to. */
export declare const ENV_API_KEY_ALT = "OPENCODE_API_KEY";
export declare const ENV_BASE_URL = "OPENCODE_GO_BASE_URL";
export declare const ENV_CACHE_TTL = "OPENCODE_GO_CACHE_TTL";
export declare const ENV_TIMEOUT_MS = "OPENCODE_GO_TIMEOUT_MS";
export declare const ENV_VISIBILITY = "OPENCODE_GO_USAGE_VISIBILITY";
/** Chip visibility when nothing overrides it. */
export declare const DEFAULT_VISIBILITY: ChipVisibility;
/** The accepted visibility modes, in settings-presentation order. */
export declare const VISIBILITY_VALUES: readonly ChipVisibility[];
/** Normalize one visibility value; anything unknown selects the default. */
export declare function parseVisibility(value: string | undefined): ChipVisibility;
/** Gateway base; `/usage` hangs off it. */
export declare const DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";
/** Credential references tried, in order, through the DSH credentials seam. */
export declare const DEFAULT_API_KEY_REFS: readonly string[];
export declare const DEFAULT_CACHE_TTL = 300;
export declare const DEFAULT_TIMEOUT_MS = 10000;
export declare const MIN_CACHE_TTL = 60;
export declare const MAX_CACHE_TTL = 3600;
/** Resolve the DSH home directory ($DSH_HOME or ~/.dsh). */
export declare function dshHome(): string;
/** Resolved location of the plugin config file. */
export declare function configFilePath(): string;
/**
 * Load and merge config from file + env vars.
 * Returns a fully resolved OcgoConfig; never throws.
 */
export declare function loadConfig(): OcgoConfig;
/** A locally configured key together with a browser-safe source label. */
export interface LocalApiKey {
    /** The key value (never sent to the browser). */
    readonly key: string;
    /** `environment` or `config`. */
    readonly source: string;
}
/**
 * The key configured locally, if any: this plugin's environment variables first
 * (matching `loadConfig`'s precedence), then the config file.
 */
export declare function loadLocalApiKey(): LocalApiKey | undefined;
/** Mask the last 4 characters of a secret for the browser (full value when ≤ 4 chars). */
export declare function maskSecret(value: string | undefined): MaskedSecret;
/**
 * Write the API key and/or the visibility mode into the config file (preserving
 * any other fields), chmod 600. Absent fields are left untouched; pass `null` to
 * clear a field (clearing the key lets the credentials seam supply it again).
 * @param partial - the fields to write.
 * @returns the stored API key, or undefined once cleared.
 */
export declare function writeConfigFile(partial: {
    apiKey?: string | null;
    visibility?: ChipVisibility | null;
}): string | undefined;
//# sourceMappingURL=config.d.ts.map