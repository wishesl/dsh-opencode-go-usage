/**
 * dsh-ocgo-usage host-API client — the same-origin JSON endpoints the browser
 * half reads and writes (`/api/ocgo-usage`, `/api/ocgo-usage/refresh` and the
 * credential editor `/api/ocgo-usage/config`). Shared by the composer chip and
 * the settings page so the wire contract has exactly one definition.
 *
 * The browser never sees the API key: the config endpoint answers with a masked
 * tail only, and accepts a new value to write host-side.
 * @module dsh-ocgo-usage/client/host-api
 */
/** The masked-prefix shown before the last-4 tail of a secret. */
export const MASK = '••••';
/** Same-origin JSON fetch helper. */
async function ocgoFetch(path, init) {
    const response = await fetch(path, init);
    if (!response.ok) {
        throw new Error(`ocgo-usage ${path} failed: ${response.status}`);
    }
    return (await response.json());
}
/** The host usage API as the browser sees it (same-origin JSON endpoints). */
export const ocgoApi = {
    view: () => ocgoFetch('/api/ocgo-usage'),
    refresh: () => ocgoFetch('/api/ocgo-usage/refresh'),
    config: () => ocgoFetch('/api/ocgo-usage/config'),
    // A present key with a null value CLEARS the local override so the DSH
    // credentials seam supplies the key again (the host distinguishes "absent,
    // keep current" from "explicitly cleared" by key presence).
    writeConfig: (partial) => ocgoFetch('/api/ocgo-usage/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(partial),
    }),
};
/** The masked display text for one secret field: `••••abcd`, or '' when unset. */
export function maskedText(secret) {
    if (secret === undefined || !secret.set || secret.tail.length === 0)
        return '';
    return `${MASK}${secret.tail}`;
}
