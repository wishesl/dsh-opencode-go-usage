/**
 * The OpenCode Go mark as the settings navigation row's glyph.
 *
 * The settings shell picks nav glyphs from a closed list of section ids
 * (`account` / `models` / `agent-presets` / `plugins` / `archived-sessions`)
 * and falls back to its own gear for every other id; `settings.section`
 * projects only `id` / `order` / `label`, so a registrant has no icon to pass —
 * the slot contract in `@deepseek-ai/dsh-client-ui-settings` and the runtime
 * slot inventory both list exactly those three options. Every third-party
 * section therefore wears the gear, this plugin included.
 *
 * So this module claims its own row once the dialog mounts and swaps the
 * fallback gear for the mark the composer chip draws (see ./ocgo-mark.ts).
 * `dshmarket`, `dsh-better-sidebar` and `dsh-skill-mcp-panel` solve it the
 * same way; the shape here follows `dshmarket`'s `settings-nav-icon.ts`.
 *
 * Scope, deliberately narrow:
 *
 * - only a row whose visible text equals this plugin's own localized section
 *   label AND that carries the shell's glyph slot as a direct child is marked;
 *   no shell structure is touched;
 * - the marker and the injected stylesheet belong to a `ctx.effect`, so they
 *   are removed with the fiber;
 * - a re-render re-claims the row through the MutationObserver, so the label
 *   and the glyph never disagree;
 * - zero matches is a valid outcome: the official gear simply stays.
 *
 * Delete this module (and its call in index.ts) the day `settings.section`
 * grows an `icon` field.
 * @module dsh-ocgo-usage/client/settings-nav-icon
 */
import { ocgoMaskUrl } from "./ocgo-mark.js";
/** Marks the one nav row this plugin owns. */
export const NAV_ICON_MARKER = 'data-ocgo-nav-icon';
/**
 * The nav rows of the settings dialog. The shell renders each
 * `settings.section` entry as a `<button>` inside the panel's `<nav>`
 * (`SettingsPanel` in `dsh-client-ui-settings-general`), and the dialog is
 * portalled into the body, which is why the observer watches the body.
 */
export const NAV_ROW_SELECTOR = '[role="dialog"] nav button';
/**
 * Glyph box in px. The shell renders every nav icon at this size
 * (`navIcon{flex:none}` + `size: 16`) and ships no media query at all; the
 * `::before` below takes the hidden `<svg>`'s place as the row's first flex
 * item, so the label keeps its exact x position and the row its exact height.
 */
export const NAV_ICON_SIZE = 16;
/**
 * Whether a nav row is this plugin's own.
 *
 * Pure, and the only decision this feature makes: the row whose visible text is
 * the section label the shell is currently projecting. An empty label matches
 * nothing — a locale that has not resolved yet must not mark the whole nav.
 * @param rowText - the row's visible text.
 * @param wantedLabel - the label this plugin's section currently registers.
 * @returns true when the row belongs to this plugin.
 */
export function isOwnNavRow(rowText, wantedLabel) {
    const wanted = String(wantedLabel ?? '').trim();
    if (wanted.length === 0)
        return false;
    return String(rowText ?? '').trim() === wanted;
}
/**
 * Whether a row carries the shell's own glyph slot as a DIRECT child.
 *
 * The shell renders `<button>[navIcon, <span>label</span>]`, so a row without a
 * direct `<svg>` is some other list's button that happens to share the text.
 * Requiring the slot keeps this module off anything it did not verify.
 * @param row - the candidate row.
 * @returns true when a direct child is an `svg`.
 */
export function hasDirectGlyphSlot(row) {
    const children = row?.children;
    if (children === undefined || children === null)
        return false;
    for (let index = 0; index < children.length; index += 1) {
        if (String(children[index]?.tagName ?? '').toLowerCase() === 'svg')
            return true;
    }
    return false;
}
/**
 * Stylesheet for the marked row: hide the shell's gear, draw the mark.
 * @param maskUrl - the mark's data URL.
 * @returns the CSS text of the owned `<style>` element.
 */
export function navIconCss(maskUrl) {
    return [
        `[${NAV_ICON_MARKER}] > svg { display: none; }`,
        `[${NAV_ICON_MARKER}]::before {`,
        `  content: '';`,
        `  flex: none;`,
        `  width: ${NAV_ICON_SIZE}px;`,
        `  height: ${NAV_ICON_SIZE}px;`,
        `  background-color: currentColor;`,
        `  -webkit-mask-image: url("${maskUrl}");`,
        `  mask-image: url("${maskUrl}");`,
        `  -webkit-mask-repeat: no-repeat;`,
        `  mask-repeat: no-repeat;`,
        `  -webkit-mask-position: center;`,
        `  mask-position: center;`,
        `  -webkit-mask-size: ${NAV_ICON_SIZE}px ${NAV_ICON_SIZE}px;`,
        `  mask-size: ${NAV_ICON_SIZE}px ${NAV_ICON_SIZE}px;`,
        `}`,
    ].join('\n');
}
/**
 * Install the nav glyph.
 * @param ctx - client context, for effect ownership.
 * @param resolveLabel - this plugin's current section label (the same thunk the
 *   `settings.section` registration passes), re-read on every sync so the glyph
 *   and the row text can never disagree.
 */
export function installSettingsNavIcon(ctx, resolveLabel) {
    if (typeof document === 'undefined')
        return;
    const doc = document;
    ctx.effect(() => {
        const tag = doc.createElement('style');
        tag.dataset.plugin = 'dsh-ocgo-usage';
        tag.dataset.pluginCss = 'dsh-ocgo-usage/settings-nav-icon';
        tag.textContent = navIconCss(ocgoMaskUrl());
        doc.head.appendChild(tag);
        let disposed = false;
        let scheduled = false;
        const sync = () => {
            scheduled = false;
            if (disposed)
                return;
            const wanted = resolveLabel();
            for (const row of Array.from(doc.querySelectorAll(NAV_ROW_SELECTOR))) {
                if (isOwnNavRow(row.textContent, wanted) && hasDirectGlyphSlot(row)) {
                    row.setAttribute(NAV_ICON_MARKER, '');
                }
                else {
                    row.removeAttribute(NAV_ICON_MARKER);
                }
            }
        };
        // Coalesce a burst of DOM mutations into one sync, and land it before the
        // next paint so the row never shows the gear first.
        const schedule = () => {
            if (scheduled || disposed)
                return;
            scheduled = true;
            queueMicrotask(sync);
        };
        sync();
        const observer = new MutationObserver(schedule);
        observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
        return () => {
            disposed = true;
            observer.disconnect();
            for (const row of Array.from(doc.querySelectorAll(`[${NAV_ICON_MARKER}]`))) {
                row.removeAttribute(NAV_ICON_MARKER);
            }
            tag.remove();
        };
    }, 'dsh-ocgo-usage: settings nav icon');
}
