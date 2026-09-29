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
import { Context, Service } from '@deepseek-ai/cordis';
import type { MaskedConfigView, OcgoUsageView } from './types.ts';
export type { NormalizedUsage, OcgoUsageView, UsageWindow, UsageWindowKind, UsageStatus, MaskedConfigView } from './types.ts';
/** Plugin configuration. */
export interface OcgoUsageConfig {
    /** Master switch for the plugin (host routes + browser readout). */
    enabled?: boolean;
}
/** One credential reference resolved through the Host credentials seam. */
export interface ResolvedCredential {
    /** The resolved secret (never logged, never sent to the browser). */
    value: string;
    /** Which layer supplied it (e.g. `store`, `environment`). */
    source: string;
}
/** Host seams the service reads through. */
export interface OcgoUsageServiceOptions {
    /**
     * Resolve one credential reference (an environment-variable name) through the
     * DSH credentials seam. Absent when the composition has no credentials
     * service, in which case only this plugin's own configured key can answer.
     */
    resolveCredential?: (ref: string) => Promise<ResolvedCredential | undefined>;
    /**
     * The provider the current model selection runs on, read on demand for
     * `provider` visibility. Absent — or answering undefined — fails OPEN: the
     * chip stays visible, because a missing probe must never silence the readout.
     */
    currentProvider?: () => string | undefined;
}
/** After a failed fetch, skip further provider queries for this long. */
export declare const FAILURE_COOLDOWN_MS = 60000;
declare module '@deepseek-ai/cordis' {
    interface Context {
        ocgoUsage: OcgoUsageService;
    }
}
/**
 * Cached OpenCode Go usage read. `view()` answers from a fresh cache, otherwise
 * queries the gateway (deduped when concurrent). A failed query enters a short
 * cooldown so a broken credential is not hammered by the poller.
 */
export declare class OcgoUsageService extends Service {
    private readonly enabled;
    private readonly options;
    private cached;
    private cachedAt;
    private lastKeySource;
    private failureUntilMs;
    private lastError;
    private inflight;
    constructor(ctx: Context, config?: OcgoUsageConfig, options?: OcgoUsageServiceOptions);
    /** Whether the service answers queries while enabled. */
    isEnabled(): boolean;
    /**
     * Resolve the effective API key: a value configured for this plugin first,
     * then the DSH credentials seam (which layers environment, store and `.env`).
     * @param refs - credential reference names to try in order.
     * @returns the key and its source, or undefined when nothing supplies one.
     */
    private resolveKey;
    /**
     * Stamp the visibility decision and the key source onto one snapshot. The
     * Host owns this so the browser runs no provider probe of its own.
     * @param view - the raw snapshot.
     * @param mode - the configured visibility mode.
     * @param keySource - the layer that supplied the key, when one did.
     * @returns the decorated snapshot.
     */
    private decorate;
    /** RPC: most recent usage view. Returns the cached view when it is still
     * fresh, otherwise re-queries the gateway (deduped when concurrent). */
    view(): Promise<OcgoUsageView>;
    /** RPC: force a fresh gateway query (bypasses the cache window). */
    refresh(): Promise<OcgoUsageView>;
    /**
     * The masked credential view for the browser config editor: which key is
     * effective, its last 4 characters, which layer supplied it, and the current
     * visibility mode. The key itself never leaves the Host.
     * @returns the masked view.
     */
    maskedConfig(): Promise<MaskedConfigView>;
    /**
     * Drop the cached usage, the failure cooldown, and the last error so the next
     * read re-queries with the freshly written config. Called after a config edit.
     */
    invalidateCache(): void;
    private query;
}
//# sourceMappingURL=service.d.ts.map