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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
/** Primary environment variable / credentials-seam reference. */
export const ENV_API_KEY = 'OPENCODE_GO_API_KEY';
/** Secondary reference, the one dsh-opencode-go defaults to. */
export const ENV_API_KEY_ALT = 'OPENCODE_API_KEY';
export const ENV_BASE_URL = 'OPENCODE_GO_BASE_URL';
export const ENV_CACHE_TTL = 'OPENCODE_GO_CACHE_TTL';
export const ENV_TIMEOUT_MS = 'OPENCODE_GO_TIMEOUT_MS';
export const ENV_VISIBILITY = 'OPENCODE_GO_USAGE_VISIBILITY';
/** Chip visibility when nothing overrides it. */
export const DEFAULT_VISIBILITY = 'always';
/** The accepted visibility modes, in settings-presentation order. */
export const VISIBILITY_VALUES = ['always', 'provider', 'never'];
/** Normalize one visibility value; anything unknown selects the default. */
export function parseVisibility(value) {
    return VISIBILITY_VALUES.find((mode) => mode === value) ?? DEFAULT_VISIBILITY;
}
/** Gateway base; `/usage` hangs off it. */
export const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1';
/** Credential references tried, in order, through the DSH credentials seam. */
export const DEFAULT_API_KEY_REFS = [ENV_API_KEY, ENV_API_KEY_ALT];
export const DEFAULT_CACHE_TTL = 300;
export const DEFAULT_TIMEOUT_MS = 10_000;
export const MIN_CACHE_TTL = 60;
export const MAX_CACHE_TTL = 3600;
/** Resolve the DSH home directory ($DSH_HOME or ~/.dsh). */
export function dshHome() {
    const explicit = process.env.DSH_HOME;
    if (typeof explicit === 'string' && explicit.length > 0)
        return explicit;
    return join(homedir(), '.dsh');
}
/** Resolved location of the plugin config file. */
export function configFilePath() {
    return join(dshHome(), 'ocgo-usage.json');
}
/**
 * Load and merge config from file + env vars.
 * Returns a fully resolved OcgoConfig; never throws.
 */
export function loadConfig() {
    const fileConfig = readFileConfig();
    const apiKey = pickString(process.env[ENV_API_KEY], process.env[ENV_API_KEY_ALT], asString(fileConfig?.apiKey));
    const rawBase = pickString(process.env[ENV_BASE_URL], asString(fileConfig?.baseUrl)) ?? DEFAULT_BASE_URL;
    // cacheTTL: clamp into [60, 3600].
    const rawTTL = pickNumber(process.env[ENV_CACHE_TTL], asNumber(fileConfig?.cacheTTL), DEFAULT_CACHE_TTL);
    const cacheTTL = clamp(rawTTL, MIN_CACHE_TTL, MAX_CACHE_TTL);
    // timeoutMs: > 0.
    const timeoutMs = Math.max(0, pickNumber(process.env[ENV_TIMEOUT_MS], asNumber(fileConfig?.timeoutMs), DEFAULT_TIMEOUT_MS));
    // visibility: an unknown value selects the default rather than silently
    // hiding the readout.
    const visibility = parseVisibility(pickString(process.env[ENV_VISIBILITY], asString(fileConfig?.visibility)));
    return {
        apiKey,
        apiKeyRefs: DEFAULT_API_KEY_REFS,
        baseUrl: rawBase.replace(/\/+$/, ''),
        cacheTTL,
        timeoutMs,
        visibility,
    };
}
/**
 * The key configured locally, if any: this plugin's environment variables first
 * (matching `loadConfig`'s precedence), then the config file.
 */
export function loadLocalApiKey() {
    const fromEnv = pickString(process.env[ENV_API_KEY], process.env[ENV_API_KEY_ALT]);
    if (fromEnv !== undefined)
        return { key: fromEnv, source: 'environment' };
    const fromFile = asString(readFileConfig()?.apiKey);
    if (fromFile !== undefined)
        return { key: fromFile, source: 'config' };
    return undefined;
}
/** Mask the last 4 characters of a secret for the browser (full value when ≤ 4 chars). */
export function maskSecret(value) {
    if (value === undefined || value.length === 0)
        return { set: false, tail: '' };
    return { set: true, tail: value.length <= 4 ? value : value.slice(-4) };
}
/**
 * Write the API key and/or the visibility mode into the config file (preserving
 * any other fields), chmod 600. Absent fields are left untouched; pass `null` to
 * clear a field (clearing the key lets the credentials seam supply it again).
 * @param partial - the fields to write.
 * @returns the stored API key, or undefined once cleared.
 */
export function writeConfigFile(partial) {
    const file = readFileConfig() ?? {};
    const next = { ...file };
    if (partial.apiKey !== undefined) {
        const v = typeof partial.apiKey === 'string' ? partial.apiKey.trim() : '';
        if (v.length > 0)
            next.apiKey = v;
        else
            delete next.apiKey;
    }
    if (partial.visibility !== undefined) {
        if (partial.visibility === null)
            delete next.visibility;
        else
            next.visibility = partial.visibility;
    }
    const path = configFilePath();
    try {
        writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    }
    catch {
        // Report the effective value rather than throwing a partial write at the
        // browser.
        return asString(next.apiKey);
    }
    return asString(next.apiKey);
}
function readFileConfig() {
    const path = configFilePath();
    if (!existsSync(path))
        return null;
    try {
        const raw = readFileSync(path, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
// --- helpers ---
function pickString(...values) {
    for (const value of values) {
        if (value && value.length > 0)
            return value;
    }
    return undefined;
}
function pickNumber(envVal, fileVal, fallback) {
    const fromEnv = envVal ? Number.parseInt(envVal, 10) : NaN;
    if (Number.isFinite(fromEnv))
        return fromEnv;
    if (fileVal !== undefined && Number.isFinite(fileVal))
        return fileVal;
    return fallback;
}
function asString(v) {
    return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function asNumber(v) {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string') {
        const n = Number.parseInt(v, 10);
        if (Number.isFinite(n))
            return n;
    }
    return undefined;
}
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
