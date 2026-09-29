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
import { Context } from '@deepseek-ai/cordis';
import { type OcgoUsageConfig } from './service.ts';
export { OcgoUsageService } from './service.ts';
export type { OcgoUsageConfig, OcgoUsageServiceOptions, ResolvedCredential, OcgoUsageView } from './service.ts';
export { OCGO_API_PREFIX, makeOcgoRoutes } from './routes.ts';
export { loadConfig, loadLocalApiKey, writeConfigFile, maskSecret, configFilePath } from './config.ts';
export type { ChipVisibility, MaskedConfigView, MaskedSecret, NormalizedUsage, OcgoConfig, UsageStatus, UsageWindow, UsageWindowKind, } from './types.ts';
export { fetchUsage, fetchViaApi, parseUsage, UsageError } from './api.ts';
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export declare const name = "ocgo-usage";
/** Services required before the usage service can answer. */
export declare const inject: string[];
/** Register the usage service and its API routes on the context. */
export declare function apply(ctx: Context, config?: OcgoUsageConfig): void;
//# sourceMappingURL=index.d.ts.map