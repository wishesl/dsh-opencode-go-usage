/**
 * @sutong12/dsh-opencode-go-usage host-API client — the same-origin JSON endpoints the browser
 * half reads and writes (`/api/ocgo-usage`, `/api/ocgo-usage/refresh` and the
 * credential editor `/api/ocgo-usage/config`). Shared by the composer chip and
 * the settings page so the wire contract has exactly one definition.
 *
 * The browser never sees the API key: the config endpoint answers with a masked
 * tail only, and accepts a new value to write host-side.
 * @module @sutong12/dsh-opencode-go-usage/client/host-api
 */
import type { ChipVisibility, MaskedConfigView, MaskedSecret, OcgoUsageView } from '../types.ts';
/** The masked-prefix shown before the last-4 tail of a secret. */
export declare const MASK = "\u2022\u2022\u2022\u2022";
/** The host usage API as the browser sees it (same-origin JSON endpoints). */
export declare const ocgoApi: {
    view: () => Promise<OcgoUsageView>;
    refresh: () => Promise<OcgoUsageView>;
    config: () => Promise<MaskedConfigView>;
    writeConfig: (partial: {
        apiKey?: string | null;
        visibility?: ChipVisibility | null;
    }) => Promise<MaskedConfigView>;
};
/** The masked display text for one secret field: `••••abcd`, or '' when unset. */
export declare function maskedText(secret: MaskedSecret | undefined): string;
//# sourceMappingURL=host-api.d.ts.map