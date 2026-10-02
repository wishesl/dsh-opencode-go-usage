/**
 * @sutong12/dsh-opencode-go-usage browser half — registers the OpenCode Go usage chip into
 * the composer tool row (`conversation.input.right`, next to the model
 * selector) and reads the host's same-origin `/api/ocgo-usage` JSON endpoints:
 * poll the host snapshot (every 10 s),
 * refresh on demand. The chip shows the three usage windows (rolling 5h /
 * weekly / monthly) in a compact form; while the host reports no usable data
 * (missing config, cookie error, or provider failure) it renders a compact
 * `<err:code>` state with a manual refresh action.
 *
 * Provider visibility is decided CLIENT-side from the live model selection:
 * `session.models` reads the in-memory current selection (2-3 ms warm, no
 * network), so switching models via `/model` is reflected on the very next
 * poll — the host's request-header fold lags until the next real request,
 * which is why visibility does not ride the usage endpoint. The chip renders
 * nothing while the current provider is not `opencode-go`, mirroring
 * pi-ocgo-usage.
 *
 * This half also registers the settings page and claims the settings nav row
 * for it, whose glyph the shell would otherwise draw as its own gear
 * (./settings-nav-icon.ts).
 * @module @sutong12/dsh-opencode-go-usage/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge (the composer tool row entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import { OCGO_PROVIDER } from '../provider.ts'
import { OcgoDockEntry, type OcgoDockEntryProps } from './OcgoDockEntry.tsx'
import { OcgoSettingsSection, type OcgoSettingsSectionProps } from './OcgoSettingsSection.tsx'
import { createProviderProbe, type ProviderProbe, type ServiceLookup } from './model-provider.ts'
import { installSettingsNavIcon } from './settings-nav-icon.ts'
import { en, zh, type OcgoKey } from './locales.ts'

export { OCGO_PROVIDER } from '../provider.ts'

export { OcgoDockEntry, formatDuration } from './OcgoDockEntry.tsx'
export type { OcgoDockEntryProps } from './OcgoDockEntry.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** @sutong12/dsh-opencode-go-usage chip copy. */
    ocgo: OcgoKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'ocgo'

/** Required services: slots for the composer tool-row entry, locale for the copy. */
export const inject = ['slots', 'locale']

/** The injected business face: the session this tool-row entry renders for. */
export interface OcgoInjected {
  /** The session this dock entry renders for (slot inject factory arg). */
  dockSessionId: string | undefined
  /** Live model-selection probe; absent leaves `provider` visibility open. */
  provider?: ProviderProbe
}

/**
 * One stable probe per session. The slot inject factory may run on every render,
 * and a fresh probe identity would make React resubscribe each time; the cache
 * also keeps the subscription's identity stable. Probes are tiny (a context
 * reference and a session id) and a composition holds few sessions.
 */
const probes = new Map<string, ProviderProbe>()

/**
 * Resolve the probe for one session, minting it on first use.
 * @param lookup - the client context, seen as a service lookup.
 * @param sessionId - the session whose selection decides visibility.
 * @returns the cached probe.
 */
function probeFor(lookup: ServiceLookup, sessionId: string): ProviderProbe {
  let probe = probes.get(sessionId)
  if (probe === undefined) {
    probe = createProviderProbe(lookup, sessionId)
    probes.set(sessionId, probe)
  }
  return probe
}

/**
 * Register the usage chip into the composer tool row next to the model selector.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), '@sutong12/dsh-opencode-go-usage: dictionaries')

  // The settings page. It keeps the credential editor reachable outside the
  // composer chip — from any session, whatever model is selected.
  //
  // `settings.section` is declared by @deepseek-ai/dsh-client-ui-settings, but
  // this package must NOT depend on it: adding that package to the install
  // graph re-resolves the DSH client packages and drops
  // @deepseek-ai/dsh-client-ui-conversation's SlotMap augmentation, which
  // erases `conversation.input.right` — the chip's own seat — from the entire
  // program (confirmed by bisecting the install). So this single registration
  // is typed by hand against a local view of the slots service while every
  // other call keeps the full SDK types. The runtime contract is unchanged:
  // `slots.inject` waits for the declaration instead of depending on activation
  // order.
  const nav = ctx.locale.bind(NS)
  // One label, two readers: the nav row the shell renders and the glyph this
  // plugin claims onto it (./settings-nav-icon.ts). Independent thunks could
  // drift apart on a dictionary edit and leave the glyph on someone else's row.
  const sectionLabel = (): string => nav('ocgo.settingsNav')
  installSettingsNavIcon(ctx, sectionLabel)
  const settingsSlots = ctx.slots as unknown as {
    inject: (key: string, callback: () => () => void) => () => void
    register: (
      options: { name: string; id: string; order: number; label: () => string; locale: string },
      component: (props: OcgoSettingsSectionProps) => unknown,
    ) => () => void
  }
  settingsSlots.inject('settings.section', () => settingsSlots.register({
    name: 'settings.section',
    id: 'ocgo-usage',
    order: 25,
    label: sectionLabel,
    locale: NS,
  }, OcgoSettingsSection))

  ctx.inject(['slots', 'conversation'], (scope: ClientContext) => {
    // `provider` visibility is settled from the model-selection service's own
    // per-session store, read structurally — see ./model-provider.ts for why it
    // is not a package dependency.
    const lookup = scope as unknown as ServiceLookup
    scope.effect(() => scope.slots.register({
      name: 'conversation.input.right',
      id: 'ocgo-usage',
      order: 110,
      locale: NS,
      inject: (sessionId): OcgoInjected => ({
        dockSessionId: sessionId,
        ...(sessionId === undefined ? {} : { provider: probeFor(lookup, sessionId) }),
      }),
    }, OcgoDockEntry), '@sutong12/dsh-opencode-go-usage: chip registration')
  })
}
