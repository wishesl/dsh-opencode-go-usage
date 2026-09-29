import { a as configFilePath, c as maskSecret, i as ENV_API_KEY_ALT, l as parseVisibility, o as loadConfig, r as ENV_API_KEY, s as loadLocalApiKey, u as writeConfigFile } from "./config-CK7UUxWI.js";
import { Service } from "@deepseek-ai/cordis";
//#region src/routes.ts
/** Browser-facing base path of the usage API. */
const OCGO_API_PREFIX = "/api/ocgo-usage";
/** Write one JSON response. */
function json(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
/** Require the method or answer 405. */
function requireMethod(req, res, method) {
	if (req.method === method) return true;
	json(res, 405, {
		ok: false,
		error: "method-not-allowed"
	});
	return false;
}
/** Read a bounded JSON request body. */
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > 65536) {
				reject(/* @__PURE__ */ new Error("body-too-large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			const raw = Buffer.concat(chunks).toString("utf8");
			if (raw.length === 0) {
				resolve({});
				return;
			}
			try {
				resolve(JSON.parse(raw));
			} catch {
				reject(/* @__PURE__ */ new Error("bad-json"));
			}
		});
		req.on("error", reject);
	});
}
/** Wrap one async usage read as a GET JSON route. */
function getRoute(path, run) {
	return {
		kind: "exact",
		path,
		handler: (req, res) => {
			if (!requireMethod(req, res, "GET")) return;
			Promise.resolve(run()).then((value) => json(res, 200, value), (error) => {
				json(res, 500, {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}
	};
}
/**
* The config editor routes: GET the masked view, POST a new key to write.
* A successful write invalidates the usage cache so the next poll re-queries
* with the fresh credential immediately (bypassing any cooldown).
*/
function makeConfigRoutes(service) {
	const read = () => service.maskedConfig();
	const write = async (req) => {
		const body = await readJsonBody(req);
		const partial = {};
		if ("apiKey" in body) partial.apiKey = typeof body.apiKey === "string" ? body.apiKey : null;
		if ("visibility" in body) partial.visibility = typeof body.visibility === "string" ? parseVisibility(body.visibility) : null;
		writeConfigFile(partial);
		service.invalidateCache();
		return service.maskedConfig();
	};
	return [{
		kind: "exact",
		path: `${OCGO_API_PREFIX}/config`,
		handler: (req, res) => {
			if (req.method === "GET") {
				Promise.resolve(read()).then((value) => json(res, 200, value), (error) => {
					json(res, 500, {
						ok: false,
						error: error instanceof Error ? error.message : String(error)
					});
				});
				return;
			}
			if (req.method === "POST") {
				Promise.resolve(write(req)).then((value) => json(res, 200, value), (error) => {
					json(res, 400, {
						ok: false,
						error: error instanceof Error ? error.message : String(error)
					});
				});
				return;
			}
			json(res, 405, {
				ok: false,
				error: "method-not-allowed"
			});
		}
	}];
}
/** Build the full usage API route family for one service. */
function makeOcgoRoutes(service) {
	return [
		getRoute(OCGO_API_PREFIX, () => service.view()),
		getRoute(`${OCGO_API_PREFIX}/refresh`, () => service.refresh()),
		...makeConfigRoutes(service)
	];
}
//#endregion
//#region src/api.ts
/** Error thrown by the HTTP / parsing layer; carries a short code for the UI. */
var UsageError = class extends Error {
	code;
	name = "UsageError";
	constructor(message, code) {
		super(message);
		this.code = code;
	}
};
/** The three windows the endpoint reports. */
const WINDOW_KINDS = [
	"rolling",
	"weekly",
	"monthly"
];
/** Build the shape error for one window. */
function invalidWindow(kind) {
	return new UsageError(`Invalid "${kind}" window in the usage response`, "invalid");
}
/**
* Validate one window object from the `usage` payload.
* @param kind - window identity to stamp onto the result.
* @param row - the raw window value.
* @returns the normalized window.
* @throws UsageError with code `invalid` when any field is missing or malformed.
*/
function parseWindow(kind, row) {
	if (row === void 0 || row === null || typeof row !== "object") throw invalidWindow(kind);
	const w = row;
	const status = w.status;
	const percent = w.percent;
	const resetsAt = w.resetsAt;
	if (status !== "ok" && status !== "rate-limited" || typeof percent !== "number" || !Number.isFinite(percent) || percent < 0 || typeof resetsAt !== "string" || !Number.isFinite(Date.parse(resetsAt))) throw invalidWindow(kind);
	return {
		kind,
		percent: clampPercent(percent),
		resetsAt,
		status
	};
}
/**
* Parse the `usage` object of the endpoint response. Windows that are absent
* are omitted; a window present but malformed fails the whole read rather than
* silently reporting zero.
* @param value - the `usage` value taken from the response body.
* @returns the normalized windows, stamped with an `updatedAt` by the caller.
* @throws UsageError with code `invalid`.
*/
function parseUsage(value) {
	if (value === void 0 || value === null || typeof value !== "object") throw new UsageError("The usage endpoint returned no usage payload", "invalid");
	const source = value;
	const result = {};
	let found = 0;
	for (const kind of WINDOW_KINDS) {
		const row = source[kind];
		if (row === void 0 || row === null) continue;
		result[kind] = parseWindow(kind, row);
		found += 1;
	}
	if (found === 0) throw new UsageError("The usage response carries no usage windows", "invalid");
	return result;
}
/** Strip query params from a URL for safe error messages. */
function sanitizeUrl(url) {
	try {
		const u = new URL(url);
		return `${u.protocol}//${u.host}${u.pathname}`;
	} catch {
		return url;
	}
}
/**
* Fetch usage from the account statistics endpoint.
* @param cfg - resolved plugin configuration.
* @param apiKey - the bearer key (never logged).
* @returns the normalized windows.
* @throws UsageError on transport, HTTP-status or shape failure.
*/
async function fetchViaApi(cfg, apiKey) {
	const url = `${cfg.baseUrl}/usage`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
	let res;
	try {
		res = await fetch(url, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				Accept: "application/json"
			},
			signal: controller.signal
		});
	} catch (e) {
		if (e instanceof Error && e.name === "AbortError") throw new UsageError(`Request timed out after ${cfg.timeoutMs}ms`, "timeout");
		throw new UsageError(String(e instanceof Error ? e.message : e), "fetch");
	} finally {
		clearTimeout(timer);
	}
	if (!res.ok) throw new UsageError(`HTTP ${res.status} for ${sanitizeUrl(url)}`, `http${res.status}`);
	let body;
	try {
		body = await res.json();
	} catch {
		throw new UsageError("The usage endpoint returned invalid JSON", "invalid");
	}
	return parseUsage(body !== null && typeof body === "object" ? body.usage : void 0);
}
/**
* Fetch usage with the current config and stamp the fetch timestamp so the UI
* can report data freshness.
* @param cfg - resolved plugin configuration.
* @param apiKey - the bearer key.
* @returns the normalized usage including `updatedAt`.
*/
async function fetchUsage(cfg, apiKey) {
	return {
		...await fetchViaApi(cfg, apiKey),
		updatedAt: Date.now()
	};
}
function clampPercent(n) {
	return Math.max(0, Math.min(100, Math.floor(n)));
}
/** True when a provider/model means "show OpenCode Go usage". */
function isOpenCodeGo(provider) {
	return provider === "opencode-go" || provider?.startsWith(`opencode-go/`) === true;
}
//#endregion
//#region src/service.ts
/**
* dsh-ocgo-usage host service — the cached OpenCode Go usage read.
*
* Resolves the API key on every operation (so a changed key reaches the next
* query without a plugin restart), fetches `GET {baseUrl}/usage`, and caches the
* result so the browser readout can poll without spamming the gateway.
*
* Key resolution is what makes this plugin zero-config on a machine that
* already runs the OpenCode Go model provider: a value configured for this
* plugin (its env vars or `$DSH_HOME/ocgo-usage.json`) wins, otherwise the DSH
* credentials seam answers — and that seam already layers the process
* environment, the provider-managed store and `.env` files, so the key the
* provider uses is found without being duplicated anywhere.
* @module dsh-ocgo-usage/service
*/
/** After a failed fetch, skip further provider queries for this long. */
const FAILURE_COOLDOWN_MS = 6e4;
/** Map a UsageError (or any error) to a browser-safe view. */
function errorView(error) {
	if (error instanceof UsageError) return {
		error: error.code,
		message: error.message
	};
	return {
		error: "fetch",
		message: error instanceof Error ? error.message : String(error)
	};
}
/**
* Whether the composer chip renders for a snapshot with this mode in force.
* @param mode - the configured visibility mode.
* @param provider - the current model selection's provider, when it is known.
* @returns true when the chip should render.
*/
function chipVisible(mode, provider) {
	if (mode === "never") return false;
	if (mode !== "provider") return true;
	return provider === void 0 ? true : isOpenCodeGo(provider);
}
/**
* Cached OpenCode Go usage read. `view()` answers from a fresh cache, otherwise
* queries the gateway (deduped when concurrent). A failed query enters a short
* cooldown so a broken credential is not hammered by the poller.
*/
var OcgoUsageService = class extends Service {
	enabled;
	options;
	cached;
	cachedAt = 0;
	lastKeySource;
	failureUntilMs = 0;
	lastError;
	inflight;
	constructor(ctx, config = {}, options = {}) {
		super(ctx, "ocgoUsage");
		this.enabled = config.enabled ?? true;
		this.options = options;
	}
	/** Whether the service answers queries while enabled. */
	isEnabled() {
		return this.enabled;
	}
	/**
	* Resolve the effective API key: a value configured for this plugin first,
	* then the DSH credentials seam (which layers environment, store and `.env`).
	* @param refs - credential reference names to try in order.
	* @returns the key and its source, or undefined when nothing supplies one.
	*/
	async resolveKey(refs) {
		const local = loadLocalApiKey();
		if (local !== void 0) return local;
		const seam = this.options.resolveCredential;
		if (seam === void 0) return void 0;
		for (const ref of refs) {
			let hit;
			try {
				hit = await seam(ref);
			} catch {
				hit = void 0;
			}
			if (hit !== void 0 && hit.value.length > 0) return {
				key: hit.value,
				source: `credentials:${hit.source}`
			};
		}
	}
	/**
	* Stamp the visibility decision and the key source onto one snapshot. The
	* Host owns this so the browser runs no provider probe of its own.
	* @param view - the raw snapshot.
	* @param mode - the configured visibility mode.
	* @param keySource - the layer that supplied the key, when one did.
	* @returns the decorated snapshot.
	*/
	decorate(view, mode, keySource) {
		const hidden = view.error === "noconfig" || view.error === "disabled";
		return {
			...view,
			...keySource === void 0 ? {} : { keySource },
			visibility: mode,
			showChip: !hidden && chipVisible(mode, this.options.currentProvider?.())
		};
	}
	/** RPC: most recent usage view. Returns the cached view when it is still
	* fresh, otherwise re-queries the gateway (deduped when concurrent). */
	async view() {
		const cfg = loadConfig();
		if (!this.enabled) return this.decorate({
			error: "disabled",
			message: "The ocgo-usage plugin is disabled."
		}, cfg.visibility);
		const now = Date.now();
		if (this.cached !== void 0 && now - this.cachedAt < cfg.cacheTTL * 1e3) return this.decorate(toView(this.cached), cfg.visibility, this.lastKeySource);
		if (now < this.failureUntilMs) return this.decorate(this.lastError ?? {
			error: "fetch",
			message: "Unknown failure"
		}, cfg.visibility);
		if (this.inflight !== void 0) return this.inflight;
		this.inflight = this.query(cfg).then((view) => {
			if (view.error === void 0) this.lastError = void 0;
			else {
				this.lastError = view;
				this.failureUntilMs = Date.now() + FAILURE_COOLDOWN_MS;
			}
			return view;
		}).finally(() => {
			this.inflight = void 0;
		});
		return this.inflight;
	}
	/** RPC: force a fresh gateway query (bypasses the cache window). */
	async refresh() {
		if (!this.enabled) return this.decorate({
			error: "disabled",
			message: "The ocgo-usage plugin is disabled."
		}, loadConfig().visibility);
		const view = await this.query(loadConfig());
		if (view.error === void 0) {
			this.lastError = void 0;
			this.failureUntilMs = 0;
		} else {
			this.lastError = view;
			this.failureUntilMs = Date.now() + FAILURE_COOLDOWN_MS;
		}
		return view;
	}
	/**
	* The masked credential view for the browser config editor: which key is
	* effective, its last 4 characters, which layer supplied it, and the current
	* visibility mode. The key itself never leaves the Host.
	* @returns the masked view.
	*/
	async maskedConfig() {
		const cfg = loadConfig();
		const resolved = await this.resolveKey(cfg.apiKeyRefs);
		return {
			apiKey: maskSecret(resolved?.key),
			...resolved === void 0 ? {} : { source: resolved.source },
			visibility: cfg.visibility
		};
	}
	/**
	* Drop the cached usage, the failure cooldown, and the last error so the next
	* read re-queries with the freshly written config. Called after a config edit.
	*/
	invalidateCache() {
		this.cached = void 0;
		this.cachedAt = 0;
		this.failureUntilMs = 0;
		this.lastError = void 0;
	}
	async query(cfg) {
		try {
			const resolved = await this.resolveKey(cfg.apiKeyRefs);
			if (resolved === void 0) throw new UsageError(`No OpenCode Go API key: set ${ENV_API_KEY} or ${ENV_API_KEY_ALT}, store it in the DSH credentials store, or paste it in Settings → OpenCode Go usage`, "noconfig");
			const data = await fetchUsage(cfg, resolved.key);
			this.cached = data;
			this.cachedAt = Date.now();
			this.lastKeySource = resolved.source;
			return this.decorate(toView(data), cfg.visibility, resolved.source);
		} catch (error) {
			return this.decorate(errorView(error), cfg.visibility);
		}
	}
};
/** Convert the internal normalized shape into the browser view. */
function toView(data) {
	return {
		updatedAt: data.updatedAt,
		...data.rolling === void 0 ? {} : { rolling: data.rolling },
		...data.weekly === void 0 ? {} : { weekly: data.weekly },
		...data.monthly === void 0 ? {} : { monthly: data.monthly }
	};
}
//#endregion
//#region src/index.ts
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
const name = "ocgo-usage";
/** Services required before the usage service can answer. */
const inject = ["webServer"];
/**
* Read the Host credentials seam when the composition provides one.
* @param ctx - the plugin context.
* @returns a resolver that answers undefined when no seam is mounted.
*/
function credentialSeam(ctx) {
	return async (ref) => {
		const credentials = ctx.get("credentials");
		if (credentials === void 0) return void 0;
		try {
			const hit = await credentials.resolve(ref);
			if (hit === void 0 || hit.value.length === 0) return void 0;
			return {
				value: hit.value,
				source: hit.source
			};
		} catch {
			return;
		}
	};
}
/**
* The current model selection's provider, read through the Host service that
* owns that selection.
*
* This is the one authority for `provider` visibility: the client-side probe the
* plugin used to run (`connection.api.sessions.models`) has no counterpart in
* DSH 0.2.0 — there is no catalogued `connection` client service, and `sessions`
* exposes no `models()` — so a browser-side check can only answer "unknown",
* which used to hide the chip unconditionally.
* @param ctx - the plugin context.
* @returns the provider id, or undefined when the selection is unavailable.
*/
function currentProvider(ctx) {
	const service = ctx.get("agentDefaultModel");
	try {
		const provider = service?.currentSelection()?.provider;
		return typeof provider === "string" && provider.length > 0 ? provider : void 0;
	} catch {
		return;
	}
}
/** Register the usage service and its API routes on the context. */
function apply(ctx, config = {}) {
	const routes = makeOcgoRoutes(new OcgoUsageService(ctx, config, {
		resolveCredential: credentialSeam(ctx),
		currentProvider: () => currentProvider(ctx)
	}));
	ctx.effect(() => {
		const disposers = routes.map((route) => ctx.webServer.register(route));
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, "ocgo-usage: routes");
}
//#endregion
export { OCGO_API_PREFIX, OcgoUsageService, UsageError, apply, configFilePath, fetchUsage, fetchViaApi, inject, loadConfig, loadLocalApiKey, makeOcgoRoutes, maskSecret, name, parseUsage, writeConfigFile };
