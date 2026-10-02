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
 * @module @sutong12/dsh-opencode-go-usage/client/model-provider
 */
/**
 * Resolve this Session's model-directory store, tolerating every failure.
 * @param ctx - a client context able to resolve services.
 * @param sessionId - the Session whose selection decides visibility.
 * @returns the store, or undefined when the service or the Session is absent.
 */
function directoryOf(ctx, sessionId) {
    try {
        const resolver = ctx.get('modelDirectories');
        return resolver?.directoryFor(sessionId)?.store;
    }
    catch {
        // `directoryFor` fails loud for a session it cannot address; unknown is our
        // answer, and `chipVisible` renders unknown as visible.
        return undefined;
    }
}
/**
 * Build the provider probe for one Session.
 * @param ctx - a client context able to resolve services.
 * @param sessionId - the Session whose selection decides visibility.
 * @returns the probe; every member answers "unknown" without the service.
 */
export function createProviderProbe(ctx, sessionId) {
    return {
        read: () => {
            const store = directoryOf(ctx, sessionId);
            if (store === undefined)
                return undefined;
            try {
                const state = store.getSnapshot();
                // `pending` first: while a switch is in flight it already holds the new
                // target, so the chip reacts to the click rather than to the settle.
                const provider = (state.pending ?? state.current)?.provider;
                return typeof provider === 'string' && provider.length > 0 ? provider : undefined;
            }
            catch {
                return undefined;
            }
        },
        subscribe: (listener) => {
            const store = directoryOf(ctx, sessionId);
            if (store === undefined)
                return () => { };
            try {
                return store.subscribe(listener);
            }
            catch {
                return () => { };
            }
        },
    };
}
