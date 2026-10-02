import { n as DEFAULT_TIMEOUT_MS } from "./config-U8TT6nVx.js";
//#region src/invariant.ts
/**
* Package invariants — cheap structural checks run at import time on the
* host side. Mirrors the pattern used by other dsh plugin packages.
* @module @sutong12/dsh-opencode-go-usage/invariant
*/
/** Assert a condition; throws a descriptive Error when violated. */
function invariant(condition, message) {
	if (!condition) throw new Error(`[@sutong12/dsh-opencode-go-usage] ${message}`);
}
/** Run every package invariant once; throws on the first violation. */
function runOcgoInvariants() {
	invariant(true, "cache TTL must be within [60, 3600]");
	invariant(DEFAULT_TIMEOUT_MS > 0, "timeout must be positive");
	invariant("https://opencode.ai/zen/go/v1".startsWith("https://"), "base URL must be http(s)");
}
runOcgoInvariants();
//#endregion
export { invariant, runOcgoInvariants };
