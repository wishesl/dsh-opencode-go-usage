/**
 * Live model-selection probe for this Session's provider.
 *
 * `@deepseek-ai/dsh-client-ui-model-selection` mounts a root client service,
 * `modelDirectories`, whose per-Session `ModelDirectory.store` is the very
 * snapshot the model selector renders from. Reading it is a synchronous
 * in-memory lookup, so the composer chip can settle `provider` visibility the
 * instant a model is picked — no Host round trip, no poll interval.
 *
 * The service is reached structurally (`ctx.get(...)`) rather than through a
 * package import on purpose: adding that package to this plugin's dependencies
 * re-resolves the DSH client packages and drops the `SlotMap` augmentation this
 * package's own slots depend on. Every failure path answers "unknown", and
 * `chipVisible` treats unknown as visible.
 * @module dsh-ocgo-usage/client/model-provider
 */
/** The slice of a Cordis context this probe needs. */
export interface ServiceLookup {
    get(key: string): unknown;
}
/** A live view of one Session's provider, plus its change notifications. */
export interface ProviderProbe {
    /** The provider in force right now; undefined while unknown. */
    read(): string | undefined;
    /**
     * Observe selection changes.
     * @param listener - called after every store update.
     * @returns the disposer, a no-op while the service is unavailable.
     */
    subscribe(listener: () => void): () => void;
}
/**
 * Build the provider probe for one Session.
 * @param ctx - a client context able to resolve services.
 * @param sessionId - the Session whose selection decides visibility.
 * @returns the probe; every member answers "unknown" without the service.
 */
export declare function createProviderProbe(ctx: ServiceLookup, sessionId: string): ProviderProbe;
//# sourceMappingURL=model-provider.d.ts.map