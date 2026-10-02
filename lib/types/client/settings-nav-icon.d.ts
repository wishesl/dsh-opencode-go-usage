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
 * @module @sutong12/dsh-opencode-go-usage/client/settings-nav-icon
 */
/** Marks the one nav row this plugin owns. */
export declare const NAV_ICON_MARKER = "data-ocgo-nav-icon";
/**
 * The nav rows of the settings dialog. The shell renders each
 * `settings.section` entry as a `<button>` inside the panel's `<nav>`
 * (`SettingsPanel` in `dsh-client-ui-settings-general`), and the dialog is
 * portalled into the body, which is why the observer watches the body.
 */
export declare const NAV_ROW_SELECTOR = "[role=\"dialog\"] nav button";
/**
 * Glyph box in px. The shell renders every nav icon at this size
 * (`navIcon{flex:none}` + `size: 16`) and ships no media query at all; the
 * `::before` below takes the hidden `<svg>`'s place as the row's first flex
 * item, so the label keeps its exact x position and the row its exact height.
 */
export declare const NAV_ICON_SIZE = 16;
/** The slice of an Element this feature touches (keeps tests free of a real DOM). */
export interface NavRow {
    /** The row's visible text — the section label the shell projects. */
    readonly textContent: string | null;
    /** Direct children, used only to check for the shell's glyph slot. */
    readonly children?: ArrayLike<{
        readonly tagName?: string;
    } | undefined> | undefined;
    /** Set the ownership marker. */
    setAttribute(name: string, value: string): void;
    /** Clear the ownership marker. */
    removeAttribute(name: string): void;
}
/** The slice of `document` this feature touches. */
export interface NavIconDocument {
    /** Where the owned stylesheet is appended. */
    readonly head: {
        appendChild(node: unknown): unknown;
    };
    /** The observer root. */
    readonly body: unknown;
    /** Create the owned `<style>` element. */
    createElement(tagName: string): {
        dataset: Record<string, string>;
        textContent: string;
        remove(): void;
    };
    /** Query the nav rows (and, during teardown, the marked ones). */
    querySelectorAll(selector: string): ArrayLike<NavRow>;
}
/** The slice of the client context this feature needs. */
export interface NavIconContext {
    /** Own the install; the callback returns the disposer. */
    effect(callback: () => unknown, label?: string): void;
}
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
export declare function isOwnNavRow(rowText: string | null | undefined, wantedLabel: string | null | undefined): boolean;
/**
 * Whether a row carries the shell's own glyph slot as a DIRECT child.
 *
 * The shell renders `<button>[navIcon, <span>label</span>]`, so a row without a
 * direct `<svg>` is some other list's button that happens to share the text.
 * Requiring the slot keeps this module off anything it did not verify.
 * @param row - the candidate row.
 * @returns true when a direct child is an `svg`.
 */
export declare function hasDirectGlyphSlot(row: NavRow | null | undefined): boolean;
/**
 * Stylesheet for the marked row: hide the shell's gear, draw the mark.
 * @param maskUrl - the mark's data URL.
 * @returns the CSS text of the owned `<style>` element.
 */
export declare function navIconCss(maskUrl: string): string;
/**
 * Install the nav glyph.
 * @param ctx - client context, for effect ownership.
 * @param resolveLabel - this plugin's current section label (the same thunk the
 *   `settings.section` registration passes), re-read on every sync so the glyph
 *   and the row text can never disagree.
 */
export declare function installSettingsNavIcon(ctx: NavIconContext, resolveLabel: () => string): void;
//# sourceMappingURL=settings-nav-icon.d.ts.map