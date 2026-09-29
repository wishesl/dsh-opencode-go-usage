/**
 * Provider matching for dsh-ocgo-usage: decide when the chip should show.
 * Pure and shared so the logic is unit-testable without a browser.
 *
 * The decision runs CLIENT-side because the browser holds the live model
 * selection (`modelDirectories` → `ModelDirectory.store`), which changes the
 * instant a model is picked. The Host only knows the effective request header,
 * so asking it would cost a round trip per change — exactly the delay this
 * function exists to avoid.
 * @module dsh-ocgo-usage/provider
 */
import type { ChipVisibility } from './types.ts';
/** The provider whose model selection shows the chip. */
export declare const OCGO_PROVIDER = "opencode-go";
/** True when a provider/model means "show OpenCode Go usage". */
export declare function isOpenCodeGo(provider: string | undefined): boolean;
/**
 * Whether the composer chip renders with this mode in force.
 * @param mode - the configured visibility mode.
 * @param provider - the session's current provider, undefined while unknown.
 * @returns true when the chip should render.
 */
export declare function chipVisible(mode: ChipVisibility, provider: string | undefined): boolean;
//# sourceMappingURL=provider.d.ts.map