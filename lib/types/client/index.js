/**
 * dsh-ocgo-usage browser half — registers the OpenCode Go usage chip into
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
 * @module dsh-ocgo-usage/client
 */
import { OcgoDockEntry } from "./OcgoDockEntry.js";
import { OcgoSettingsSection } from "./OcgoSettingsSection.js";
import { createProviderProbe } from "./model-provider.js";
import { en, zh } from "./locales.js";
export { OCGO_PROVIDER } from "../provider.js";
export { OcgoDockEntry, formatDuration } from "./OcgoDockEntry.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'ocgo';
/** Required services: slots for the composer tool-row entry, locale for the copy. */
export const inject = ['slots', 'locale'];
/**
 * One stable probe per session. The slot inject factory may run on every render,
 * and a fresh probe identity would make React resubscribe each time; the cache
 * also keeps the subscription's identity stable. Probes are tiny (a context
 * reference and a session id) and a composition holds few sessions.
 */
const probes = new Map();
/**
 * Resolve the probe for one session, minting it on first use.
 * @param lookup - the client context, seen as a service lookup.
 * @param sessionId - the session whose selection decides visibility.
 * @returns the cached probe.
 */
function probeFor(lookup, sessionId) {
    let probe = probes.get(sessionId);
    if (probe === undefined) {
        probe = createProviderProbe(lookup, sessionId);
        probes.set(sessionId, probe);
    }
    return probe;
}
/**
 * Register the usage chip into the composer tool row next to the model selector.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-ocgo-usage: dictionaries');
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
    const nav = ctx.locale.bind(NS);
    const settingsSlots = ctx.slots;
    settingsSlots.inject('settings.section', () => settingsSlots.register({
        name: 'settings.section',
        id: 'ocgo-usage',
        order: 25,
        label: () => nav('ocgo.settingsNav'),
        locale: NS,
    }, OcgoSettingsSection));
    ctx.inject(['slots', 'conversation'], (scope) => {
        // `provider` visibility is settled from the model-selection service's own
        // per-session store, read structurally — see ./model-provider.ts for why it
        // is not a package dependency.
        const lookup = scope;
        scope.effect(() => scope.slots.register({
            name: 'conversation.input.right',
            id: 'ocgo-usage',
            order: 110,
            locale: NS,
            inject: (sessionId) => ({
                dockSessionId: sessionId,
                ...(sessionId === undefined ? {} : { provider: probeFor(lookup, sessionId) }),
            }),
        }, OcgoDockEntry), 'dsh-ocgo-usage: chip registration');
    });
}
