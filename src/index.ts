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

import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { makeOcgoRoutes } from './routes.ts'
import { OcgoUsageService, type OcgoUsageConfig, type ResolvedCredential } from './service.ts'

export { OcgoUsageService } from './service.ts'
export type { OcgoUsageConfig, OcgoUsageServiceOptions, ResolvedCredential, OcgoUsageView } from './service.ts'
export { OCGO_API_PREFIX, makeOcgoRoutes } from './routes.ts'
export { loadConfig, loadLocalApiKey, writeConfigFile, maskSecret, configFilePath } from './config.ts'
export type {
  ChipVisibility,
  MaskedConfigView,
  MaskedSecret,
  NormalizedUsage,
  OcgoConfig,
  UsageStatus,
  UsageWindow,
  UsageWindowKind,
} from './types.ts'
export { fetchUsage, fetchViaApi, parseUsage, UsageError } from './api.ts'

/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'ocgo-usage'

/** Services required before the usage service can answer. */
export const inject = ['webServer']

/**
 * The Host credentials seam reduced to the one call this plugin makes.
 * `CredentialRef` is a branded string, so a plain reference name is already the
 * runtime value and this plugin needs no build dependency on the credentials
 * package just to name one.
 */
interface CredentialResolver {
  resolve(ref: string): Promise<{ value: string; source: string } | undefined>
}

/**
 * Read the Host credentials seam when the composition provides one.
 * @param ctx - the plugin context.
 * @returns a resolver that answers undefined when no seam is mounted.
 */
function credentialSeam(ctx: Context): (ref: string) => Promise<ResolvedCredential | undefined> {
  return async (ref: string) => {
    const lookup = ctx as unknown as { get(key: string): unknown }
    const credentials = lookup.get('credentials') as CredentialResolver | undefined
    if (credentials === undefined) return undefined
    try {
      const hit = await credentials.resolve(ref)
      if (hit === undefined || hit.value.length === 0) return undefined
      return { value: hit.value, source: hit.source }
    } catch {
      return undefined
    }
  }
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
function currentProvider(ctx: Context): string | undefined {
  const lookup = ctx as unknown as { get(key: string): unknown }
  const service = lookup.get('agentDefaultModel') as
    | { currentSelection(): { provider?: unknown } | undefined }
    | undefined
  try {
    const provider = service?.currentSelection()?.provider
    return typeof provider === 'string' && provider.length > 0 ? provider : undefined
  } catch {
    return undefined
  }
}

/** Register the usage service and its API routes on the context. */
export function apply(ctx: Context, config: OcgoUsageConfig = {}): void {
  const service = new OcgoUsageService(ctx, config, {
    resolveCredential: credentialSeam(ctx),
    currentProvider: () => currentProvider(ctx),
  })

  // The routes are registered while the plugin is enabled.
  const routes = makeOcgoRoutes(service)
  ctx.effect(
    () => {
      const disposers = routes.map((route) => ctx.webServer.register(route))
      return () => {
        for (const dispose of disposers) dispose()
      }
    },
    'ocgo-usage: routes',
  )
}
