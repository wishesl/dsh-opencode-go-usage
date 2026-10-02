/**
 * @sutong12/dsh-opencode-go-usage host service — the cached OpenCode Go usage read.
 *
 * Resolves the API key on every operation (so a changed key reaches the next
 * query without a plugin restart), fetches `GET {baseUrl}/usage`, and caches the
 * result so the browser readout can poll without spamming the gateway.
 *
 * Key resolution is what makes this plugin zero-config on a machine that
 * already runs the OpenCode Go model provider: a value configured for this
 * plugin (its env vars or `$DSH_HOME/ocgo-usage.json`) wins, otherwise the DSH
 * credentials seam answers — and that seam already layers the process
 * environment, the provider-managed store and `.env` files, so the key the
 * provider uses is found without being duplicated anywhere.
 * @module @sutong12/dsh-opencode-go-usage/service
 */
import { Service } from '@deepseek-ai/cordis';
import { fetchUsage, UsageError } from "./api.js";
import { ENV_API_KEY, ENV_API_KEY_ALT, loadConfig, loadLocalApiKey, maskSecret } from "./config.js";
/** After a failed fetch, skip further provider queries for this long. */
export const FAILURE_COOLDOWN_MS = 60_000;
/** Map a UsageError (or any error) to a browser-safe view. */
function errorView(error) {
    if (error instanceof UsageError) {
        return { error: error.code, message: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { error: 'fetch', message };
}
/**
 * Whether an access failure leaves the last successful round usable.
 *
 * A timeout, a transport failure, a gateway hiccup (408/425/429) or a server
 * error says nothing about the NUMBERS — they are the account's, they simply
 * could not be re-read this time, so the previous round stays on screen. A
 * rejected credential or a malformed payload is different: the user must see
 * it, and it is never masked by stale data.
 * @param error - the failure thrown by the query.
 * @returns true when the previous round may be served instead of the error.
 */
function isTransientError(error) {
    const code = error instanceof UsageError ? error.code : 'fetch';
    return code === 'timeout' || code === 'fetch' || /^http(?:408|425|429|5\d\d)$/.test(code);
}
/**
 * Cached OpenCode Go usage read. `view()` answers from a fresh cache, otherwise
 * queries the gateway (deduped when concurrent). A failed query enters a short
 * cooldown so a broken credential is not hammered by the poller, and a
 * TRANSIENT failure (timeout, transport, 5xx) during it serves the previous
 * round marked `stale` instead of replacing the numbers with an error.
 */
export class OcgoUsageService extends Service {
    enabled;
    options;
    cached;
    cachedAt = 0;
    lastKeySource;
    failureUntilMs = 0;
    lastError;
    inflight;
    constructor(ctx, config = {}, options = {}) {
        super(ctx, 'ocgoUsage');
        this.enabled = config.enabled ?? true;
        this.options = options;
    }
    /** Whether the service answers queries while enabled. */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Resolve the effective API key: a value configured for this plugin first,
     * then the DSH credentials seam (which layers environment, store and `.env`).
     * @param refs - credential reference names to try in order.
     * @returns the key and its source, or undefined when nothing supplies one.
     */
    async resolveKey(refs) {
        const local = loadLocalApiKey();
        if (local !== undefined)
            return local;
        const seam = this.options.resolveCredential;
        if (seam === undefined)
            return undefined;
        for (const ref of refs) {
            let hit;
            try {
                hit = await seam(ref);
            }
            catch {
                hit = undefined;
            }
            if (hit !== undefined && hit.value.length > 0) {
                return { key: hit.value, source: `credentials:${hit.source}` };
            }
        }
        return undefined;
    }
    /**
     * Stamp the visibility mode and the key source onto one snapshot. The Host
     * reports the mode; the browser applies it to its own live model selection,
     * so a `provider` change never waits for a poll.
     * @param view - the raw snapshot.
     * @param mode - the configured visibility mode.
     * @param keySource - the layer that supplied the key, when one did.
     * @returns the decorated snapshot.
     */
    decorate(view, mode, keySource) {
        return {
            ...view,
            ...(keySource === undefined ? {} : { keySource }),
            visibility: mode,
        };
    }
    /** RPC: most recent usage view. Returns the cached view when it is still
     * fresh, otherwise re-queries the gateway (deduped when concurrent). */
    async view() {
        const cfg = loadConfig();
        if (!this.enabled)
            return this.decorate({ error: 'disabled', message: 'The ocgo-usage plugin is disabled.' }, cfg.visibility);
        const now = Date.now();
        if (this.cached !== undefined && now - this.cachedAt < cfg.cacheTTL * 1000) {
            return this.decorate(toView(this.cached), cfg.visibility, this.lastKeySource);
        }
        // Failure cooldown: keep serving the last known answer without a fetch —
        // the previous round's numbers when a round exists (marked stale), the
        // recorded error otherwise.
        if (now < this.failureUntilMs) {
            return this.staleView(cfg)
                ?? this.lastError
                ?? this.decorate({ error: 'fetch', message: 'Unknown failure' }, cfg.visibility);
        }
        if (this.inflight !== undefined)
            return this.inflight;
        // Failure consequences (cooldown + recorded error) are settled inside
        // query(), so this only forwards the answer it produces.
        this.inflight = this.query(cfg).finally(() => {
            this.inflight = undefined;
        });
        return this.inflight;
    }
    /** RPC: force a fresh gateway query (bypasses the cache window). */
    async refresh() {
        if (!this.enabled)
            return this.decorate({ error: 'disabled', message: 'The ocgo-usage plugin is disabled.' }, loadConfig().visibility);
        return this.query(loadConfig());
    }
    /**
     * The masked credential view for the browser config editor: which key is
     * effective, its last 4 characters, which layer supplied it, and the current
     * visibility mode. The key itself never leaves the Host.
     * @returns the masked view.
     */
    async maskedConfig() {
        const cfg = loadConfig();
        const resolved = await this.resolveKey(cfg.apiKeyRefs);
        return {
            apiKey: maskSecret(resolved?.key),
            ...(resolved === undefined ? {} : { source: resolved.source }),
            visibility: cfg.visibility,
        };
    }
    /**
     * Drop the cached usage, the failure cooldown, and the last error so the next
     * read re-queries the gateway with the freshly written credential.
     */
    invalidateCache() {
        this.cached = undefined;
        this.cachedAt = 0;
        this.failureUntilMs = 0;
        this.lastError = undefined;
    }
    /**
     * Apply the cache consequences of one configuration write.
     *
     * Only a CREDENTIAL change invalidates: the numbers belong to the account, so a
     * visibility-only write must not cost a gateway round trip. That trip is
     * exactly what made switching the display mode feel laggy — the composer chip
     * renders from the read that carries the mode, so it cannot show the new mode
     * until that read answers. A mode change needs no re-query at all:
     * {@link OcgoUsageService.decorate} re-attaches the live mode to every answer,
     * cached ones included.
     * @param changed - which fields the write actually touched.
     */
    noteConfigWrite(changed) {
        if (changed.apiKey)
            this.invalidateCache();
    }
    async query(cfg) {
        try {
            const resolved = await this.resolveKey(cfg.apiKeyRefs);
            if (resolved === undefined) {
                throw new UsageError(`No OpenCode Go API key: set ${ENV_API_KEY} or ${ENV_API_KEY_ALT}, store it in the DSH credentials store, or paste it in Settings → OpenCode Go usage`, 'noconfig');
            }
            const data = await fetchUsage(cfg, resolved.key);
            this.cached = data;
            this.cachedAt = Date.now();
            this.lastKeySource = resolved.source;
            this.lastError = undefined;
            this.failureUntilMs = 0;
            return this.decorate(toView(data), cfg.visibility, resolved.source);
        }
        catch (error) {
            // Record the failure for the cooldown either way, then prefer the
            // previous round over an error view while the failure is transient: one
            // timed-out access must not blank the readout the last round produced.
            this.lastError = this.decorate(errorView(error), cfg.visibility);
            this.failureUntilMs = Date.now() + FAILURE_COOLDOWN_MS;
            if (isTransientError(error)) {
                const stale = this.staleView(cfg);
                if (stale !== undefined)
                    return stale;
            }
            return this.lastError;
        }
    }
    /**
     * The previous successful round dressed as a stale answer. Only reachable
     * while a round is cached: before the first success there is nothing to fall
     * back to and the real error must surface.
     * @param cfg - the resolved configuration (visibility + key source).
     * @returns the stale view, or undefined when no round has ever succeeded.
     */
    staleView(cfg) {
        if (this.cached === undefined)
            return undefined;
        return this.decorate({ ...toView(this.cached), stale: true }, cfg.visibility, this.lastKeySource);
    }
}
/** Convert the internal normalized shape into the browser view. */
function toView(data) {
    return {
        updatedAt: data.updatedAt,
        ...(data.rolling === undefined ? {} : { rolling: data.rolling }),
        ...(data.weekly === undefined ? {} : { weekly: data.weekly }),
        ...(data.monthly === undefined ? {} : { monthly: data.monthly }),
    };
}
