/**
 * Provider matching for @sutong12/dsh-opencode-go-usage: decide when the chip should show.
 * Pure and shared so the logic is unit-testable without a browser.
 *
 * The decision runs CLIENT-side because the browser holds the live model
 * selection (`modelDirectories` → `ModelDirectory.store`), which changes the
 * instant a model is picked. The Host only knows the effective request header,
 * so asking it would cost a round trip per change — exactly the delay this
 * function exists to avoid.
 * @module @sutong12/dsh-opencode-go-usage/provider
 */

import type { ChipVisibility } from './types.ts'

/** The provider whose model selection shows the chip. */
export const OCGO_PROVIDER = 'opencode-go'

/** True when a provider/model means "show OpenCode Go usage". */
export function isOpenCodeGo(provider: string | undefined): boolean {
  return provider === OCGO_PROVIDER || provider?.startsWith(`${OCGO_PROVIDER}/`) === true
}

/**
 * Whether the composer chip renders with this mode in force.
 * @param mode - the configured visibility mode.
 * @param provider - the session's current provider, undefined while unknown.
 * @returns true when the chip should render.
 */
export function chipVisible(mode: ChipVisibility, provider: string | undefined): boolean {
  if (mode === 'never') return false
  if (mode !== 'provider') return true
  // Unknown fails OPEN: a missing probe must never silence the readout.
  return provider === undefined ? true : isOpenCodeGo(provider)
}
