/**
 * The composer tool-row entry: the OpenCode Go usage readout, mounted in the
 * composer tool row (`conversation.input.right`) next to the model selector.
 * The chip polls the host `/api/ocgo-usage` endpoint for the three usage
 * windows (rolling 5h / weekly / monthly); clicking reveals per-window reset
 * countdowns, a masked API-key editor and a manual refresh. In an error state,
 * clicking the chip opens that editor directly so a rejected key can be
 * replaced in place.
 *
 * Visibility is decided by the HOST ANSWER, not by the session's model: the
 * numbers belong to this OpenCode Go account whichever provider the session
 * runs, so the chip renders as soon as the host reports anything other than
 * "no credential configured". (An earlier revision mirrored pi-ocgo-usage and
 * hid itself unless the live model was `opencode-go`; that read the session's
 * in-memory selection through an RPC this plugin does not need — and when that
 * probe answers nothing the chip hid unconditionally, which is exactly what
 * happened on DSH 0.2.0.)
 * @module dsh-ocgo-usage/client/OcgoDockEntry
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
export { formatDuration } from './windows.ts';
/** Composed props of the dock entry (runtime + locale + the injected session face). */
export type OcgoDockEntryProps = PropsRuntime<'conversation.input.right'> & PropsLocale<typeof NS> & {
    dockSessionId?: string | undefined;
};
/**
 * The OpenCode Go usage chip: polls the host snapshot, renders the three
 * windows inline, and expands into a detail panel on click.
 * @param props - the composed dock entry props.
 */
export declare function OcgoDockEntry(props: OcgoDockEntryProps): React.ReactElement | null;
//# sourceMappingURL=OcgoDockEntry.d.ts.map