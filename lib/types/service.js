/**
 * dsh-ocgo-usage host service — the cached OpenCode Go usage read.
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
 * @module dsh-ocgo-usage/service
 */
import { Service } from '@deepseek-ai/cordis';
import { fetchUsage, UsageError } from "./api.js";
import { ENV_API_KEY, ENV_API_KEY_ALT, loadConfig, loadLocalApiKey, maskSecret } from "./config.js";
import { isOpenCodeGo } from "./provider.js";
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
 * Whether the composer chip renders for a snapshot with this mode in force.
 * @param mode - the configured visibility mode.
 * @param provider - the current model selection's provider, when it is known.
 * @returns true when the chip should render.
 */
function chipVisible(mode, provider) {
    if (mode === 'never')
        return false;
    if (mode !== 'provider')
        return true;
    return provider === undefined ? true : isOpenCodeGo(provider);
}
/**
 * Cached OpenCode Go usage read. `view()` answers from a fresh cache, otherwise
 * queries the gateway (deduped when concurrent). A failed query enters a short
 * cooldown so a broken credential is not hammered by the poller.
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
     * Stamp the visibility decision and the key source onto one snapshot. The
     * Host owns this so the browser runs no provider probe of its own.
     * @param view - the raw snapshot.
     * @param mode - the configured visibility mode.
     * @param keySource - the layer that supplied the key, when one did.
     * @returns the decorated snapshot.
     */
    decorate(view, mode, keySource) {
        // An unconfigured or switched-off plugin has nothing to say in the composer,
        // whatever the visibility mode: no permanent error chip there.
        const hidden = view.error === 'noconfig' || view.error === 'disabled';
        return {
            ...view,
            ...(keySource === undefined ? {} : { keySource }),
            visibility: mode,
            showChip: !hidden && chipVisible(mode, this.options.currentProvider?.()),
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
        // Failure cooldown: keep serving the last known error without a fetch.
        if (now < this.failureUntilMs) {
            return this.decorate(this.lastError ?? { error: 'fetch', message: 'Unknown failure' }, cfg.visibility);
        }
        if (this.inflight !== undefined)
            return this.inflight;
        this.inflight = this.query(cfg).then((view) => {
            if (view.error === undefined) {
                this.lastError = undefined;
            }
            else {
                this.lastError = view;
                this.failureUntilMs = Date.now() + FAILURE_COOLDOWN_MS;
            }
            return view;
        }).finally(() => {
            this.inflight = undefined;
        });
        return this.inflight;
    }
    /** RPC: force a fresh gateway query (bypasses the cache window). */
    async refresh() {
        if (!this.enabled)
            return this.decorate({ error: 'disabled', message: 'The ocgo-usage plugin is disabled.' }, loadConfig().visibility);
        const view = await this.query(loadConfig());
        if (view.error === undefined) {
            this.lastError = undefined;
            this.failureUntilMs = 0;
        }
        else {
            this.lastError = view;
            this.failureUntilMs = Date.now() + FAILURE_COOLDOWN_MS;
        }
        return view;
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
     * read re-queries with the freshly written config. Called after a config edit.
     */
    invalidateCache() {
        this.cached = undefined;
        this.cachedAt = 0;
        this.failureUntilMs = 0;
        this.lastError = undefined;
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
            return this.decorate(toView(data), cfg.visibility, resolved.source);
        }
        catch (error) {
            return this.decorate(errorView(error), cfg.visibility);
        }
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
