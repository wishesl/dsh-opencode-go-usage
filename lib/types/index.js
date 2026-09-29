/**
 * dsh-ocgo-usage host half — mounts the usage service and its HTTP routes.
 *
 * Usage is read from the OpenCode Go JSON API (`GET {baseUrl}/usage`) with the
 * account API key, so the browser half never touches a session cookie. The key
 * is resolved per operation: this plugin's own environment/config value first,
 * otherwise the DSH credentials seam — the same store the OpenCode Go model
 * provider already authenticates with.
 *
 * The browser half (the `./client` entry) reads the three usage windows
 * (rolling 5h / weekly / monthly) through the same-origin
 * `/api/ocgo-usage` JSON endpoints.
 * @module dsh-ocgo-usage
 */
import { makeOcgoRoutes } from "./routes.js";
import { OcgoUsageService } from "./service.js";
export { OcgoUsageService } from "./service.js";
export { OCGO_API_PREFIX, makeOcgoRoutes } from "./routes.js";
export { loadConfig, loadLocalApiKey, writeConfigFile, maskSecret, configFilePath } from "./config.js";
export { fetchUsage, fetchViaApi, parseUsage, UsageError } from "./api.js";
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'ocgo-usage';
/** Services required before the usage service can answer. */
export const inject = ['webServer'];
/**
 * Read the Host credentials seam when the composition provides one.
 * @param ctx - the plugin context.
 * @returns a resolver that answers undefined when no seam is mounted.
 */
function credentialSeam(ctx) {
    return async (ref) => {
        const lookup = ctx;
        const credentials = lookup.get('credentials');
        if (credentials === undefined)
            return undefined;
        try {
            const hit = await credentials.resolve(ref);
            if (hit === undefined || hit.value.length === 0)
                return undefined;
            return { value: hit.value, source: hit.source };
        }
        catch {
            return undefined;
        }
    };
}
/**
 * The current model selection's provider, read through the Host service that
 * owns that selection.
 *
 * This is the one authority for `provider` visibility: the client-side probe the
 * plugin used to run (`connection.api.sessions.models`) has no counterpart in
 * DSH 0.2.0 — there is no catalogued `connection` client service, and `sessions`
 * exposes no `models()` — so a browser-side check can only answer "unknown",
 * which used to hide the chip unconditionally.
 * @param ctx - the plugin context.
 * @returns the provider id, or undefined when the selection is unavailable.
 */
function currentProvider(ctx) {
    const lookup = ctx;
    const service = lookup.get('agentDefaultModel');
    try {
        const provider = service?.currentSelection()?.provider;
        return typeof provider === 'string' && provider.length > 0 ? provider : undefined;
    }
    catch {
        return undefined;
    }
}
/** Register the usage service and its API routes on the context. */
export function apply(ctx, config = {}) {
    const service = new OcgoUsageService(ctx, config, {
        resolveCredential: credentialSeam(ctx),
        currentProvider: () => currentProvider(ctx),
    });
    // The routes are registered while the plugin is enabled.
    const routes = makeOcgoRoutes(service);
    ctx.effect(() => {
        const disposers = routes.map((route) => ctx.webServer.register(route));
        return () => {
            for (const dispose of disposers)
                dispose();
        };
    }, 'ocgo-usage: routes');
}
