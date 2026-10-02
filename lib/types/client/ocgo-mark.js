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
 * @module dsh-ocgo-usage/client/ocgo-mark
 */
/** The art box of the mark, as shipped. */
export const OCGO_MARK_VIEW_BOX = '0 0 54 30';
/** Height of the art, in art units. */
const OCGO_MARK_ART_HEIGHT = 30;
/**
 * Side of the square box the mark is centred in when a 1:1 glyph slot needs it
 * (the settings nav renders every glyph in a 16px square). Padding the box
 * instead of stretching the art keeps the mark's own proportions.
 */
export const OCGO_MARK_BOX = 54;
/** Vertical offset centring the art inside the square box. */
export const OCGO_MARK_OFFSET_Y = (OCGO_MARK_BOX - OCGO_MARK_ART_HEIGHT) / 2;
/** The mark's paths, in the order the official art draws them. */
export const OCGO_MARK_PATHS = [
    { d: 'M24 30H0V0H24V6H6V24H18V18H12V12H24V30Z', tone: 'ink' },
    { d: 'M12 18H18V24H6V12H12V18Z', tone: 'accent' },
    { d: 'M48 12V24H36V12H48Z', tone: 'accent' },
    { d: 'M54 30H30V0H54V30ZM36 24H48V6H36V24Z', tone: 'ink' },
];
/** The chip's two-tone palette: the mark's ink and its accent counters per theme. */
export const OCGO_MARK_INK = {
    light: { ink: '#211E1E', accent: '#CFCECD' },
    dark: { ink: '#e6edf3', accent: '#646464' },
};
/**
 * The plate the chip paints behind the mark in dark mode. Only the chip draws
 * it: a mask reads alpha alone, so a nav glyph that included it would be a
 * solid 16px square.
 */
export const OCGO_MARK_DARK_BG = '#2c2c2e';
/**
 * The mark as a standalone square SVG, for a CSS `mask-image`.
 *
 * Filled pure black on purpose: a mask reads alpha only, and the visible colour
 * comes from the element's `background-color`. Only the ink paths are drawn —
 * the accent counters fill the very negative space that makes the "C" legible,
 * and at a 16px glyph slot that turns the mark into a solid block.
 * @returns the mask SVG source.
 */
export function ocgoMaskSvg() {
    const paths = OCGO_MARK_PATHS
        .filter((path) => path.tone === 'ink')
        .map((path) => `<path d="${path.d}" fill="#000"/>`)
        .join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '
        + `${OCGO_MARK_BOX} ${OCGO_MARK_BOX}" fill="#000">`
        + `<g transform="translate(0 ${OCGO_MARK_OFFSET_Y})">${paths}</g></svg>`;
}
/**
 * The mask URL for the mark, percent-encoded at runtime (never hand-escaped, so
 * a `#` in the art can never truncate the URL).
 * @param svg - the mask source; defaults to {@link ocgoMaskSvg}.
 * @returns a `data:` URL usable in CSS.
 */
export function ocgoMaskUrl(svg = ocgoMaskSvg()) {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
