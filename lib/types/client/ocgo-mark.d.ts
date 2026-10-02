/**
 * The official OpenCode Go mark, defined exactly once.
 *
 * Two surfaces draw it: the composer chip (`OcgoDockEntry`'s `OcgoLogo`) paints
 * it two-tone in the chip's own palette, and the settings navigation row needs
 * the same shape as a single-colour CSS mask (see ./settings-nav-icon.ts). Both
 * read the path data here, so the nav entry always reads as the same thing as
 * the panel it opens — the same reason ./windows.ts holds the shared labels.
 *
 * The art is the shipped `assets/ocgo-logo.svg` (light) and
 * `assets/ocgo-logo-dark.svg` (dark); the files stay as the source of truth for
 * review, while these strings are what the bundle can actually reach (a browser
 * half cannot fetch a file out of the plugin package).
 * @module @sutong12/dsh-opencode-go-usage/client/ocgo-mark
 */
/** The art box of the mark, as shipped. */
export declare const OCGO_MARK_VIEW_BOX = "0 0 54 30";
/**
 * Side of the square box the mark is centred in when a 1:1 glyph slot needs it
 * (the settings nav renders every glyph in a 16px square). Padding the box
 * instead of stretching the art keeps the mark's own proportions.
 */
export declare const OCGO_MARK_BOX = 54;
/** Vertical offset centring the art inside the square box. */
export declare const OCGO_MARK_OFFSET_Y: number;
/**
 * Which ink a surface paints one path with: the mark's own ink (`ink`), or an
 * accent counter that sits inside the mark's negative space (`accent`).
 */
export type OcgoMarkTone = 'ink' | 'accent';
/** One path of the mark, in draw order. */
export interface OcgoMarkPath {
    /** SVG path data. */
    readonly d: string;
    /** The ink this path belongs to. */
    readonly tone: OcgoMarkTone;
}
/** The mark's paths, in the order the official art draws them. */
export declare const OCGO_MARK_PATHS: readonly OcgoMarkPath[];
/** The chip's two-tone palette: the mark's ink and its accent counters per theme. */
export declare const OCGO_MARK_INK: {
    readonly light: {
        readonly ink: "#211E1E";
        readonly accent: "#CFCECD";
    };
    readonly dark: {
        readonly ink: "#e6edf3";
        readonly accent: "#646464";
    };
};
/**
 * The plate the chip paints behind the mark in dark mode. Only the chip draws
 * it: a mask reads alpha alone, so a nav glyph that included it would be a
 * solid 16px square.
 */
export declare const OCGO_MARK_DARK_BG = "#2c2c2e";
/**
 * The mark as a standalone square SVG, for a CSS `mask-image`.
 *
 * Filled pure black on purpose: a mask reads alpha only, and the visible colour
 * comes from the element's `background-color`. Only the ink paths are drawn —
 * the accent counters fill the very negative space that makes the "C" legible,
 * and at a 16px glyph slot that turns the mark into a solid block.
 * @returns the mask SVG source.
 */
export declare function ocgoMaskSvg(): string;
/**
 * The mask URL for the mark, percent-encoded at runtime (never hand-escaped, so
 * a `#` in the art can never truncate the URL).
 * @param svg - the mask source; defaults to {@link ocgoMaskSvg}.
 * @returns a `data:` URL usable in CSS.
 */
export declare function ocgoMaskUrl(svg?: string): string;
//# sourceMappingURL=ocgo-mark.d.ts.map