/**
 * The OpenCode Go usage settings page (slot `settings.section`, id
 * `ocgo-usage`).
 *
 * The composer chip is provider-gated — it renders nothing whenever the live
 * model is not `opencode-go` — so its inline editor is unreachable exactly when
 * a user most needs it: repairing a rejected API key. This page owns the same
 * host write path unconditionally.
 *
 * The credential is the OpenCode Go API key that `GET {baseUrl}/usage` is
 * authenticated with. On a machine that already runs the OpenCode Go model
 * provider the key is normally found in the DSH credentials store with no
 * configuration at all, so the page reports which layer supplied it and only
 * writes an override when the user pastes one.
 * @module dsh-ocgo-usage/client/OcgoSettingsSection
 */
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
/**
 * Props of the settings page: the shell's owner face plus the locale dictionary.
 *
 * Spelled out rather than as `PropsRuntime<'settings.section'>` on purpose:
 * that key is declared by @deepseek-ai/dsh-client-ui-settings, which this
 * package does not depend on. See the registration note in ./index.ts.
 */
export type OcgoSettingsSectionProps = PropsLocale<typeof NS> & {
    /** Shell affordance for a section that leaves settings (unused by this page). */
    close?: () => void;
};
/**
 * The OpenCode Go usage settings page.
 * @param props - the composed settings-section props.
 * @returns the section content.
 */
export declare function OcgoSettingsSection(props: OcgoSettingsSectionProps): React.ReactElement;
//# sourceMappingURL=OcgoSettingsSection.d.ts.map