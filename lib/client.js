window.__ModuleLoader__.load({
	id: "@sutong12/dsh-opencode-go-usage",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/provider.ts
		/** The provider whose model selection shows the chip. */
		const OCGO_PROVIDER = "opencode-go";
		/** True when a provider/model means "show OpenCode Go usage". */
		function isOpenCodeGo(provider) {
			return provider === "opencode-go" || provider?.startsWith(`opencode-go/`) === true;
		}
		/**
		* Whether the composer chip renders with this mode in force.
		* @param mode - the configured visibility mode.
		* @param provider - the session's current provider, undefined while unknown.
		* @returns true when the chip should render.
		*/
		function chipVisible(mode, provider) {
			if (mode === "never") return false;
			if (mode !== "provider") return true;
			return provider === void 0 ? true : isOpenCodeGo(provider);
		}
		//#endregion
		//#region src/client/config-bus.ts
		/**
		* In-bundle change bus.
		*
		* The settings page writes the configuration; the composer chip reads it. They
		* are two components of one client bundle, so a module-level subscriber list is
		* all that is needed to let a write take effect on the chip immediately instead
		* of on its next poll. Nothing here crosses a bundle boundary — a second copy of
		* this plugin would simply not see the notification.
		* @module @sutong12/dsh-opencode-go-usage/client/config-bus
		*/
		/** Listeners waiting for a config write made through this bundle. */
		const listeners = /* @__PURE__ */ new Set();
		/**
		* Subscribe to configuration writes made through this bundle.
		* @param listener - called after a successful write.
		* @returns the disposer.
		*/
		function onConfigChanged(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		/**
		* Announce a successful configuration write.
		*
		* A misbehaving listener must never fail the write that triggered it, so every
		* listener is isolated; the snapshot also keeps a listener that unsubscribes
		* during notification from perturbing the walk.
		*/
		function notifyConfigChanged() {
			for (const listener of [...listeners]) try {
				listener();
			} catch {}
		}
		//#endregion
		//#region src/client/ocgo-mark.ts
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
		const OCGO_MARK_VIEW_BOX = "0 0 54 30";
		/** The mark's paths, in the order the official art draws them. */
		const OCGO_MARK_PATHS = [
			{
				d: "M24 30H0V0H24V6H6V24H18V18H12V12H24V30Z",
				tone: "ink"
			},
			{
				d: "M12 18H18V24H6V12H12V18Z",
				tone: "accent"
			},
			{
				d: "M48 12V24H36V12H48Z",
				tone: "accent"
			},
			{
				d: "M54 30H30V0H54V30ZM36 24H48V6H36V24Z",
				tone: "ink"
			}
		];
		/** The chip's two-tone palette: the mark's ink and its accent counters per theme. */
		const OCGO_MARK_INK = {
			light: {
				ink: "#211E1E",
				accent: "#CFCECD"
			},
			dark: {
				ink: "#e6edf3",
				accent: "#646464"
			}
		};
		/**
		* The mark as a standalone square SVG, for a CSS `mask-image`.
		*
		* Filled pure black on purpose: a mask reads alpha only, and the visible colour
		* comes from the element's `background-color`. Only the ink paths are drawn —
		* the accent counters fill the very negative space that makes the "C" legible,
		* and at a 16px glyph slot that turns the mark into a solid block.
		* @returns the mask SVG source.
		*/
		function ocgoMaskSvg() {
			return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 54 54" fill="#000"><g transform="translate(0 12)">${OCGO_MARK_PATHS.filter((path) => path.tone === "ink").map((path) => `<path d="${path.d}" fill="#000"/>`).join("")}</g></svg>`;
		}
		/**
		* The mask URL for the mark, percent-encoded at runtime (never hand-escaped, so
		* a `#` in the art can never truncate the URL).
		* @param svg - the mask source; defaults to {@link ocgoMaskSvg}.
		* @returns a `data:` URL usable in CSS.
		*/
		function ocgoMaskUrl(svg = ocgoMaskSvg()) {
			return `data:image/svg+xml,${encodeURIComponent(svg)}`;
		}
		//#endregion
		//#region src/client/host-api.ts
		/** The masked-prefix shown before the last-4 tail of a secret. */
		const MASK = "••••";
		/** Same-origin JSON fetch helper. */
		async function ocgoFetch(path, init) {
			const response = await fetch(path, init);
			if (!response.ok) throw new Error(`ocgo-usage ${path} failed: ${response.status}`);
			return await response.json();
		}
		/** The host usage API as the browser sees it (same-origin JSON endpoints). */
		const ocgoApi = {
			view: () => ocgoFetch("/api/ocgo-usage"),
			refresh: () => ocgoFetch("/api/ocgo-usage/refresh"),
			config: () => ocgoFetch("/api/ocgo-usage/config"),
			writeConfig: (partial) => ocgoFetch("/api/ocgo-usage/config", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(partial)
			})
		};
		/** The masked display text for one secret field: `••••abcd`, or '' when unset. */
		function maskedText(secret) {
			if (secret === void 0 || !secret.set || secret.tail.length === 0) return "";
			return `${MASK}${secret.tail}`;
		}
		//#endregion
		//#region \0dsh-css:E:\gopackage2\2026-8\woker1\dsh-opencode-go-usage\src\client\ocgo.module.css.mjs
		const css = ".aBs8ea_wrap{display:inline-flex;position:relative}.aBs8ea_chip{height:24px;color:var(--dsw-alias-label-primary,#0f1115);cursor:pointer;white-space:nowrap;user-select:none;background:0 0;border:0;border-radius:999px;align-items:center;gap:6px;padding:0 6px 0 8px;font-size:12px;line-height:1;transition:background-color .12s;display:inline-flex}.aBs8ea_chip:hover,.aBs8ea_chipOpen{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}.aBs8ea_seg{align-items:baseline;gap:3px;display:inline-flex}.aBs8ea_segSep{opacity:.45}.aBs8ea_logo{flex:none;display:inline-flex}.aBs8ea_chevron{color:var(--dsw-alias-label-caption,#81858c);flex:none;transition:transform .12s;display:inline-flex}.aBs8ea_chevronOpen{transform:rotate(180deg)}.aBs8ea_segWarn50{color:var(--dsw-static-amber-400,#f7ad31)}.aBs8ea_segWarn60{color:var(--dsw-static-amber-500,#f59e0b)}.aBs8ea_segWarn70{color:var(--dsw-static-amber-600,#dd8629)}.aBs8ea_segErr80{color:var(--dsw-alias-state-error-primary,#dc2626)}.aBs8ea_segCrit90{color:var(--dsw-alias-state-error-primary,#dc2626);font-weight:600}.aBs8ea_details{z-index:40;border:1px solid var(--dsw-alias-border-l2,#0000001a);background-color:var(--dsw-alias-bg-layer-1,Canvas);background-image:linear-gradient(var(--dsw-specific-menu,transparent), var(--dsw-specific-menu,transparent)), linear-gradient(var(--dsw-alias-bg-layer-2,Canvas), var(--dsw-alias-bg-layer-2,Canvas));min-width:220px;color:var(--dsw-alias-label-primary,#0f1115);box-shadow:var(--dsw-shadow-lv3,0 4px 12px #00000014);border-radius:8px;flex-direction:column;gap:6px;padding:8px 10px;font-size:12px;display:flex;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translate(-50%)}.aBs8ea_window{justify-content:space-between;align-items:center;gap:12px;display:flex}.aBs8ea_windowLabel{color:var(--dsw-alias-label-secondary,#61666b);opacity:.9;align-items:center;gap:6px;display:inline-flex}.aBs8ea_windowValue{font-variant-numeric:tabular-nums;align-items:baseline;gap:6px;display:inline-flex}.aBs8ea_windowReset{opacity:.65;font-variant-numeric:tabular-nums;font-size:11px}.aBs8ea_foot{border-top:1px solid var(--dsw-alias-border-l1,#0000000a);justify-content:space-between;align-items:center;gap:8px;padding-top:6px;font-size:11px;display:flex}.aBs8ea_footRight{align-items:center;gap:8px;margin-left:auto;display:inline-flex}.aBs8ea_setBtn{color:var(--dsw-alias-state-business-primary,#3964fe);cursor:pointer;background:0 0;border:0;padding:0;font-size:11px}.aBs8ea_setBtn:hover{text-decoration:underline}.aBs8ea_fetchedAt{opacity:.6}.aBs8ea_fetchedStale{color:var(--dsw-alias-state-warn-primary,#f59e0b);opacity:1}.aBs8ea_staleHint{color:var(--dsw-alias-state-warn-primary,#f59e0b);margin:0;font-size:11px;line-height:1.6}.aBs8ea_refreshBtn{color:var(--dsw-alias-state-business-primary,#3964fe);cursor:pointer;background:0 0;border:0;padding:0;font-size:11px}.aBs8ea_refreshBtn:hover{text-decoration:underline}.aBs8ea_setPanel{flex-direction:column;gap:8px;min-width:260px;display:flex}.aBs8ea_field{flex-direction:column;gap:3px;display:flex}.aBs8ea_fieldLabel{color:var(--dsw-alias-label-secondary,#61666b);opacity:.75;font-variant-numeric:tabular-nums;font-size:11px}.aBs8ea_fieldInput{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-layer-1,#fff);width:100%;color:var(--dsw-alias-label-primary,#0f1115);font-variant-numeric:tabular-nums;border-radius:6px;outline:none;height:26px;padding:0 8px;font-size:12px}.aBs8ea_fieldInput:focus{border-color:var(--dsw-alias-state-business-primary,#3964fe)}.aBs8ea_setHint{opacity:.55;font-size:11px}.aBs8ea_errorText{color:var(--dsw-alias-state-error-primary,#dc2626);white-space:normal;max-width:240px;font-size:11px}.aBs8ea_section{max-width:620px;color:var(--dsw-alias-label-primary,#0f1115);flex-direction:column;gap:16px;display:flex}.aBs8ea_sectionTitle{margin:0;font-size:15px;font-weight:600;line-height:1.4}.aBs8ea_sectionIntro{color:var(--dsw-alias-label-secondary,#61666b);margin:6px 0 0;font-size:12px;line-height:1.6}.aBs8ea_card{border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-layer-1,#fff);border-radius:10px;flex-direction:column;gap:10px;padding:14px 16px;display:flex}.aBs8ea_cardTitle{font-size:13px;font-weight:600}.aBs8ea_row{flex-direction:column;gap:4px;display:flex}.aBs8ea_label{color:var(--dsw-alias-label-secondary,#61666b);font-size:12px}.aBs8ea_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#0000001a);background:var(--dsw-alias-bg-base,#fff);width:100%;height:30px;color:var(--dsw-alias-label-primary,#0f1115);font-variant-numeric:tabular-nums;border-radius:6px;outline:none;padding:0 10px;font-size:12px}.aBs8ea_input:focus{border-color:var(--dsw-alias-state-business-primary,#4176e6)}.aBs8ea_hint{color:var(--dsw-alias-label-secondary,#61666b);opacity:.85;margin:0;font-size:11px;line-height:1.6}.aBs8ea_actions{flex-wrap:wrap;align-items:center;gap:10px;display:flex}.aBs8ea_primary{background:var(--dsw-alias-button-primary-fill,#0f1115);height:28px;color:var(--dsw-alias-label-primary-foreground,#fff);cursor:pointer;border:0;border-radius:6px;padding:0 14px;font-size:12px}.aBs8ea_fieldInput:focus-visible,.aBs8ea_input:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}.aBs8ea_primary:disabled{opacity:.5;cursor:default}.aBs8ea_secondary{border:1px solid var(--dsw-alias-border-l2,#0000001a);height:28px;color:var(--dsw-alias-label-primary,#0f1115);cursor:pointer;background:0 0;border-radius:6px;padding:0 12px;font-size:12px}.aBs8ea_secondary:hover,.aBs8ea_secondary:focus-visible{background:var(--dsw-alias-bg-layer-2,#2631480f)}.aBs8ea_secondary:disabled{opacity:.5;cursor:default}.aBs8ea_noticeOk{color:var(--dsw-alias-state-success-primary,#16a34a);font-size:11px}.aBs8ea_noticeErr{color:var(--dsw-alias-state-error-primary,#dc2626);margin:0;font-size:11px;line-height:1.5}.aBs8ea_warn{border-left:2px solid var(--dsw-alias-state-warn-primary,#f59e0b);color:var(--dsw-alias-label-secondary,#61666b);margin:0;padding-left:8px;font-size:11px;line-height:1.6}.aBs8ea_usageList{flex-direction:column;gap:8px;display:flex}.aBs8ea_usageRow{justify-content:space-between;align-items:center;gap:12px;font-size:12px;display:flex}.aBs8ea_usageLabel{color:var(--dsw-alias-label-secondary,#61666b)}.aBs8ea_usageValue{font-variant-numeric:tabular-nums;align-items:baseline;gap:8px;display:inline-flex}.aBs8ea_usageReset{opacity:.65;font-size:11px}.aBs8ea_options{flex-direction:column;gap:6px;display:flex}.aBs8ea_option{border:1px solid var(--dsw-alias-border-l2,#0000001a);color:var(--dsw-alias-label-primary,#0f1115);font:inherit;text-align:left;cursor:pointer;background:0 0;border-radius:8px;flex-direction:column;gap:2px;padding:8px 10px;display:flex}.aBs8ea_option:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2,#2631480f)}.aBs8ea_option:disabled{opacity:.5;cursor:default}.aBs8ea_optionActive{border-color:var(--dsw-alias-state-business-primary,#4176e6);box-shadow:inset 3px 0 0 var(--dsw-alias-state-business-primary,#4176e6)}.aBs8ea_optionLabel{font-size:12px;font-weight:600}.aBs8ea_optionHint{color:var(--dsw-alias-label-secondary,#61666b);font-size:11px;line-height:1.5}";
		const tagId = "@sutong12/dsh-opencode-go-usage/ocgo.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@sutong12/dsh-opencode-go-usage";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var ocgo_module_css_default = {
			"actions": "aBs8ea_actions",
			"card": "aBs8ea_card",
			"cardTitle": "aBs8ea_cardTitle",
			"chevron": "aBs8ea_chevron",
			"chevronOpen": "aBs8ea_chevronOpen",
			"chip": "aBs8ea_chip",
			"chipOpen": "aBs8ea_chipOpen",
			"details": "aBs8ea_details",
			"errorText": "aBs8ea_errorText",
			"fetchedAt": "aBs8ea_fetchedAt",
			"fetchedStale": "aBs8ea_fetchedStale",
			"field": "aBs8ea_field",
			"fieldInput": "aBs8ea_fieldInput",
			"fieldLabel": "aBs8ea_fieldLabel",
			"foot": "aBs8ea_foot",
			"footRight": "aBs8ea_footRight",
			"hint": "aBs8ea_hint",
			"input": "aBs8ea_input",
			"label": "aBs8ea_label",
			"logo": "aBs8ea_logo",
			"noticeErr": "aBs8ea_noticeErr",
			"noticeOk": "aBs8ea_noticeOk",
			"option": "aBs8ea_option",
			"optionActive": "aBs8ea_optionActive",
			"optionHint": "aBs8ea_optionHint",
			"optionLabel": "aBs8ea_optionLabel",
			"options": "aBs8ea_options",
			"primary": "aBs8ea_primary",
			"refreshBtn": "aBs8ea_refreshBtn",
			"row": "aBs8ea_row",
			"secondary": "aBs8ea_secondary",
			"section": "aBs8ea_section",
			"sectionIntro": "aBs8ea_sectionIntro",
			"sectionTitle": "aBs8ea_sectionTitle",
			"seg": "aBs8ea_seg",
			"segCrit90": "aBs8ea_segCrit90",
			"segErr80": "aBs8ea_segErr80",
			"segSep": "aBs8ea_segSep",
			"segWarn50": "aBs8ea_segWarn50",
			"segWarn60": "aBs8ea_segWarn60",
			"segWarn70": "aBs8ea_segWarn70",
			"setBtn": "aBs8ea_setBtn",
			"setHint": "aBs8ea_setHint",
			"setPanel": "aBs8ea_setPanel",
			"staleHint": "aBs8ea_staleHint",
			"usageLabel": "aBs8ea_usageLabel",
			"usageList": "aBs8ea_usageList",
			"usageReset": "aBs8ea_usageReset",
			"usageRow": "aBs8ea_usageRow",
			"usageValue": "aBs8ea_usageValue",
			"warn": "aBs8ea_warn",
			"window": "aBs8ea_window",
			"windowLabel": "aBs8ea_windowLabel",
			"windowReset": "aBs8ea_windowReset",
			"windowValue": "aBs8ea_windowValue",
			"wrap": "aBs8ea_wrap"
		};
		//#endregion
		//#region src/client/windows.ts
		/** Short window label for the inline chip: 5h / wk / mo. */
		const WINDOW_LABELS = {
			rolling: "5h",
			weekly: "wk",
			monthly: "mo"
		};
		/** Full window label key for the detail panel and the settings page. */
		const WINDOW_TITLE_KEYS = {
			rolling: "ocgo.rolling",
			weekly: "ocgo.weekly",
			monthly: "ocgo.monthly"
		};
		/**
		* Seconds until a window resets, clamped at 0 for a reset instant already past.
		* The API reports an absolute `resetsAt`, so the countdown is derived at render
		* time instead of being read from the payload.
		* @param window - the usage window.
		* @returns whole seconds remaining.
		*/
		function resetInSec(window) {
			const at = Date.parse(window.resetsAt);
			if (!Number.isFinite(at)) return 0;
			return Math.max(0, Math.round((at - Date.now()) / 1e3));
		}
		/**
		* Format a duration (seconds) compactly: 45s / 23m / 5h 23m / 4d 6h.
		* @param totalSec - seconds until a window resets.
		* @returns the compact human duration.
		*/
		function formatDuration(totalSec) {
			if (totalSec < 60) return `${Math.max(0, Math.floor(totalSec))}s`;
			if (totalSec < 3600) return `${Math.floor(totalSec / 60)}m`;
			if (totalSec < 86400) {
				const h = Math.floor(totalSec / 3600);
				const m = Math.floor(totalSec % 3600 / 60);
				return m > 0 ? `${h}h ${m}m` : `${h}h`;
			}
			const d = Math.floor(totalSec / 86400);
			const h = Math.floor(totalSec % 86400 / 3600);
			return h > 0 ? `${d}d ${h}h` : `${d}d`;
		}
		/**
		* Format an epoch-ms time as a local HH:MM clock.
		* @param epochMs - epoch milliseconds.
		* @returns the `HH:MM` text.
		*/
		function formatClock(epochMs) {
			const d = new Date(epochMs);
			return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
		}
		/**
		* The severity class of one window (muted → escalating warn → err).
		* @param window - the usage window to classify.
		* @returns the CSS-module class name, or undefined below the first threshold.
		*/
		function severityClass(window) {
			if (window.status === "rate-limited" || window.percent >= 90) return ocgo_module_css_default.segCrit90;
			if (window.percent >= 80) return ocgo_module_css_default.segErr80;
			if (window.percent >= 70) return ocgo_module_css_default.segWarn70;
			if (window.percent >= 60) return ocgo_module_css_default.segWarn60;
			if (window.percent >= 50) return ocgo_module_css_default.segWarn50;
		}
		//#endregion
		//#region src/client/OcgoDockEntry.tsx
		/**
		* The composer tool-row entry: the OpenCode Go usage readout, mounted in the
		* composer tool row (`conversation.input.right`) next to the model selector.
		* The chip polls the host `/api/ocgo-usage` endpoint for the three usage
		* windows (rolling 5h / weekly / monthly); clicking reveals per-window reset
		* countdowns, a masked API-key editor and a manual refresh. In an error state,
		* clicking the chip opens that editor directly so a rejected key can be
		* replaced in place.
		*
		* Visibility is decided by the HOST ANSWER, not by the session's model: the
		* numbers belong to this OpenCode Go account whichever provider the session
		* runs, so the chip renders as soon as the host reports anything other than
		* "no credential configured". (An earlier revision mirrored pi-ocgo-usage and
		* hid itself unless the live model was `opencode-go`; that read the session's
		* in-memory selection through an RPC this plugin does not need — and when that
		* probe answers nothing the chip hid unconditionally, which is exactly what
		* happened on DSH 0.2.0.)
		* @module @sutong12/dsh-opencode-go-usage/client/OcgoDockEntry
		*/
		/** Poll interval for the host usage snapshot. The provider gate does not wait
		* for it: the model-selection store notifies this component directly. */
		const POLL_MS = 1e4;
		/** A disposer that does nothing, for a probe that could not subscribe. */
		const NOOP = () => {};
		/** Detect dark mode via DSH body attribute. */
		function useDarkMode() {
			const [dark, setDark] = (0, react.useState)(() => {
				if (typeof document === "undefined") return false;
				return document.body.hasAttribute("data-ds-dark-theme");
			});
			(0, react.useEffect)(() => {
				const el = document.body;
				if (!el) return;
				const observer = new MutationObserver(() => {
					setDark(el.hasAttribute("data-ds-dark-theme"));
				});
				observer.observe(el, {
					attributes: true,
					attributeFilter: ["data-ds-dark-theme"]
				});
				return () => observer.disconnect();
			}, []);
			return dark;
		}
		/**
		* The official OpenCode Go logo mark, inlined to avoid extra asset requests.
		* The art itself lives in ./ocgo-mark.ts so the settings navigation row can
		* draw the very same mark as its glyph.
		*/
		function OcgoLogo() {
			const dark = useDarkMode();
			const ink = dark ? OCGO_MARK_INK.dark : OCGO_MARK_INK.light;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: ocgo_module_css_default.logo,
				width: "22",
				height: "12",
				viewBox: OCGO_MARK_VIEW_BOX,
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				children: [dark && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					width: "100%",
					height: "100%",
					fill: "#2c2c2e"
				}), OCGO_MARK_PATHS.map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: path.d,
					fill: ink[path.tone]
				}, path.d))]
			});
		}
		/** Render one window segment: compact `· 5h 23%`, full `· 5h 23% (3h 25m)`. */
		function WindowSegment(props) {
			const { window, sep, compact = false } = props;
			const cls = severityClass(window);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: ocgo_module_css_default.seg,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ocgo_module_css_default.segSep,
					children: sep
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: cls ?? void 0,
					children: [
						WINDOW_LABELS[window.kind],
						" ",
						window.percent,
						"%",
						!compact ? ` (${formatDuration(resetInSec(window))})` : ""
					]
				})]
			});
		}
		/**
		* The OpenCode Go usage chip: polls the host snapshot, renders the three
		* windows inline, and expands into a detail panel on click.
		* @param props - the composed dock entry props.
		*/
		function OcgoDockEntry(props) {
			const [view, setView] = (0, react.useState)(null);
			const [answered, setAnswered] = (0, react.useState)(false);
			const [unreachable, setUnreachable] = (0, react.useState)(false);
			const [open, setOpen] = (0, react.useState)(false);
			const [mode, setMode] = (0, react.useState)("view");
			const [config, setConfig] = (0, react.useState)(null);
			const [keyDraft, setKeyDraft] = (0, react.useState)("");
			const wrapRef = (0, react.useRef)(null);
			const modeRef = (0, react.useRef)("view");
			modeRef.current = mode;
			const draftsRef = (0, react.useRef)({ key: "" });
			draftsRef.current = { key: keyDraft };
			const configRef = (0, react.useRef)(null);
			configRef.current = config;
			const probe = props.provider;
			const subscribeProvider = (0, react.useCallback)((onChange) => probe === void 0 ? NOOP : probe.subscribe(onChange), [probe]);
			const readProvider = (0, react.useCallback)(() => probe?.read(), [probe]);
			const provider = (0, react.useSyncExternalStore)(subscribeProvider, readProvider);
			/** One periodic tick: read the host's usage snapshot. */
			const pollNow = (0, react.useCallback)(() => {
				let live = true;
				ocgoApi.view().then((snapshot) => {
					if (!live) return;
					setView(snapshot);
					setUnreachable(false);
					setAnswered(true);
				}, () => {
					if (!live) return;
					setUnreachable(true);
					setAnswered(true);
				});
				return () => {
					live = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				const cleanup = pollNow();
				const timer = window.setInterval(pollNow, POLL_MS);
				const onVisibility = () => {
					if (document.visibilityState === "visible") pollNow();
				};
				document.addEventListener("visibilitychange", onVisibility);
				return () => {
					cleanup();
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", onVisibility);
				};
			}, [pollNow]);
			(0, react.useEffect)(() => onConfigChanged(pollNow), [pollNow]);
			/** Load the masked config into the editor drafts. */
			const loadConfig = (0, react.useCallback)(() => {
				ocgoApi.config().then((snapshot) => {
					setConfig(snapshot);
					setKeyDraft(maskedText(snapshot.apiKey));
				}, () => {
					setConfig(null);
					setKeyDraft("");
				});
			}, []);
			/** Submit any edited field; returns the write promise (fire-and-forget on blur). */
			const saveConfig = (0, react.useCallback)(() => {
				const baseline = configRef.current;
				const partial = {};
				const key = draftsRef.current.key.trim();
				if (key.length > 0 && key !== maskedText(baseline?.apiKey)) partial.apiKey = key;
				if (Object.keys(partial).length === 0) return;
				ocgoApi.writeConfig(partial).then((snapshot) => {
					setConfig(snapshot);
					setKeyDraft(maskedText(snapshot.apiKey));
					pollNow();
				}, () => {});
			}, [pollNow]);
			/** Close the panel; in set mode a blur/close acts as confirm (save). */
			const closePanel = (0, react.useCallback)(() => {
				if (modeRef.current === "set") saveConfig();
				setOpen(false);
				setMode("view");
			}, [saveConfig]);
			/** Open the editor (used by the Set button and the error chip). */
			const openSet = (0, react.useCallback)(() => {
				setMode("set");
				setOpen(true);
				loadConfig();
			}, [loadConfig]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onPointerDown = (event) => {
					const target = event.target;
					if (target !== null && wrapRef.current !== null && !wrapRef.current.contains(target)) closePanel();
				};
				const onKeyDown = (event) => {
					if (event.key === "Escape") closePanel();
				};
				document.addEventListener("pointerdown", onPointerDown);
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open, closePanel]);
			const refresh = () => {
				ocgoApi.refresh().then((snapshot) => {
					setView(snapshot);
					setUnreachable(false);
				}, () => {
					setUnreachable(true);
				});
			};
			const t = props.t;
			const sep = ` ${t("ocgo.sep")} `;
			if (!answered) return null;
			if (view !== null && (view.error === "noconfig" || view.error === "disabled")) return null;
			if (!chipVisible(view?.visibility ?? "always", provider)) return null;
			const error = view === null ? {
				code: "fetch",
				message: t("ocgo.error", { code: "fetch" })
			} : view.error !== void 0 ? {
				code: view.error,
				message: view.message ?? t("ocgo.error", { code: view.error })
			} : null;
			if (error !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: ocgo_module_css_default.wrap,
				ref: wrapRef,
				"data-testid": "ocgo-chip-error",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: open ? `${ocgo_module_css_default.chip} ${ocgo_module_css_default.chipOpen}` : ocgo_module_css_default.chip,
					onClick: () => {
						if (open) closePanel();
						else openSet();
					},
					title: `${error.message}\n${t("ocgo.set")}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OcgoLogo, {}),
						" <err:",
						error.code,
						">"
					]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ocgo_module_css_default.details,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: ocgo_module_css_default.setPanel,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: ocgo_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ocgo_module_css_default.fieldLabel,
								children: t("ocgo.apiKey")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: ocgo_module_css_default.fieldInput,
								value: keyDraft,
								placeholder: "sk-…",
								spellCheck: false,
								autoComplete: "off",
								onChange: (e) => {
									setKeyDraft(e.target.value);
								},
								onFocus: (e) => {
									if (e.target.value === maskedText(config?.apiKey)) e.target.select();
								}
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: ocgo_module_css_default.foot,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ocgo_module_css_default.setHint,
								children: t("ocgo.setHint")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ocgo_module_css_default.refreshBtn,
								onClick: closePanel,
								children: t("ocgo.save")
							})]
						})]
					})
				})]
			});
			const snapshot = view;
			const stale = unreachable || snapshot.stale === true;
			const windows = [
				snapshot.rolling,
				snapshot.weekly,
				snapshot.monthly
			].filter((w) => w !== void 0);
			if (windows.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: ocgo_module_css_default.chip,
				onClick: refresh,
				title: t("ocgo.refresh"),
				"data-testid": "ocgo-chip-empty",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OcgoLogo, {}),
					" ",
					t("ocgo.unavailable")
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: ocgo_module_css_default.wrap,
				ref: wrapRef,
				"data-testid": "ocgo-chip",
				"data-stale": stale || void 0,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: open ? `${ocgo_module_css_default.chip} ${ocgo_module_css_default.chipOpen}` : ocgo_module_css_default.chip,
					onClick: () => {
						if (open) closePanel();
						else setOpen(true);
					},
					title: stale ? t("ocgo.stale") : open ? t("ocgo.collapse") : t("ocgo.expand"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OcgoLogo, {}),
						windows.map((w) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WindowSegment, {
							window: w,
							sep,
							compact: true
						}, w.kind)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: open ? `${ocgo_module_css_default.chevron} ${ocgo_module_css_default.chevronOpen}` : ocgo_module_css_default.chevron,
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
								width: "12",
								height: "12",
								viewBox: "0 0 12 12",
								fill: "none",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
									d: "M3 4.5L6 7.5L9 4.5",
									stroke: "currentColor",
									strokeWidth: "1.5",
									strokeLinecap: "round",
									strokeLinejoin: "round"
								})
							})
						})
					]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ocgo_module_css_default.details,
					children: mode === "set" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: ocgo_module_css_default.setPanel,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: ocgo_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ocgo_module_css_default.fieldLabel,
								children: t("ocgo.apiKey")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: ocgo_module_css_default.fieldInput,
								value: keyDraft,
								placeholder: "sk-…",
								spellCheck: false,
								autoComplete: "off",
								onChange: (e) => {
									setKeyDraft(e.target.value);
								},
								onFocus: (e) => {
									if (e.target.value === maskedText(config?.apiKey)) e.target.select();
								}
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: ocgo_module_css_default.foot,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ocgo_module_css_default.setHint,
								children: t("ocgo.setHint")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ocgo_module_css_default.refreshBtn,
								onClick: closePanel,
								children: t("ocgo.save")
							})]
						})]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [windows.map((w) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: ocgo_module_css_default.window,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ocgo_module_css_default.windowLabel,
							children: w.status === "rate-limited" ? t("ocgo.rateLimited") : t(WINDOW_TITLE_KEYS[w.kind])
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: ocgo_module_css_default.windowValue,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: severityClass(w) ?? void 0,
								children: [w.percent, "%"]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ocgo_module_css_default.windowReset,
								children: t("ocgo.resetsIn", { duration: formatDuration(resetInSec(w)) })
							})]
						})]
					}, w.kind)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: ocgo_module_css_default.foot,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ocgo_module_css_default.setBtn,
							onClick: openSet,
							children: t("ocgo.set")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: ocgo_module_css_default.footRight,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ocgo_module_css_default.refreshBtn,
								onClick: refresh,
								children: t("ocgo.refresh")
							}), snapshot.updatedAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: stale ? `${ocgo_module_css_default.fetchedAt} ${ocgo_module_css_default.fetchedStale}` : ocgo_module_css_default.fetchedAt,
								title: stale ? t("ocgo.stale") : void 0,
								children: t("ocgo.fetchedAt", { time: formatClock(snapshot.updatedAt) })
							})]
						})]
					})] })
				})]
			});
		}
		//#endregion
		//#region src/client/OcgoSettingsSection.tsx
		/**
		* The OpenCode Go usage settings page (slot `settings.section`, id
		* `ocgo-usage`).
		*
		* The composer chip is provider-gated — it renders nothing whenever the live
		* model is not `opencode-go` — so its inline editor is unreachable exactly when
		* a user most needs it: repairing a rejected API key. This page owns the same
		* host write path unconditionally.
		*
		* The credential is the OpenCode Go API key that `GET {baseUrl}/usage` is
		* authenticated with. On a machine that already runs the OpenCode Go model
		* provider the key is normally found in the DSH credentials store with no
		* configuration at all, so the page reports which layer supplied it and only
		* writes an override when the user pastes one.
		* @module @sutong12/dsh-opencode-go-usage/client/OcgoSettingsSection
		*/
		/** The visibility modes, in presentation order. */
		const VISIBILITY_OPTIONS = [
			"always",
			"provider",
			"never"
		];
		/** Option label keys, one per mode. */
		const VISIBILITY_LABELS = {
			always: "ocgo.visAlways",
			provider: "ocgo.visProvider",
			never: "ocgo.visNever"
		};
		/** Option hint keys, one per mode. */
		const VISIBILITY_HINTS = {
			always: "ocgo.visAlwaysHint",
			provider: "ocgo.visProviderHint",
			never: "ocgo.visNeverHint"
		};
		/**
		* The OpenCode Go usage settings page.
		* @param props - the composed settings-section props.
		* @returns the section content.
		*/
		function OcgoSettingsSection(props) {
			const [config, setConfig] = (0, react.useState)(null);
			const [view, setView] = (0, react.useState)(null);
			const [keyDraft, setKeyDraft] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)(null);
			const tRef = (0, react.useRef)(props.t);
			tRef.current = props.t;
			const configRef = (0, react.useRef)(null);
			configRef.current = config;
			const draftRef = (0, react.useRef)("");
			draftRef.current = keyDraft;
			/** Adopt one masked snapshot as both the diff baseline and the field draft. */
			const adopt = (0, react.useCallback)((snapshot) => {
				setConfig(snapshot);
				setKeyDraft(maskedText(snapshot.apiKey));
			}, []);
			/** Read the masked credential view and the current usage snapshot. */
			const load = (0, react.useCallback)(() => {
				ocgoApi.config().then(adopt, () => {
					setNotice({
						kind: "err",
						text: tRef.current("ocgo.loadFailed")
					});
				});
				ocgoApi.view().then((snapshot) => {
					setView(snapshot);
				}, () => {});
			}, [adopt]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			/**
			* Write the pasted key only when its text differs from the masked baseline,
			* then re-query so the page shows the numbers that credential actually yields.
			*/
			const save = (0, react.useCallback)(() => {
				const key = draftRef.current.trim();
				if (key.length === 0 || key === maskedText(configRef.current?.apiKey)) {
					setNotice({
						kind: "err",
						text: tRef.current("ocgo.noChanges")
					});
					return;
				}
				setBusy(true);
				setNotice(null);
				ocgoApi.writeConfig({ apiKey: key }).then((snapshot) => {
					adopt(snapshot);
					setBusy(false);
					setNotice({
						kind: "ok",
						text: tRef.current("ocgo.saved")
					});
					notifyConfigChanged();
					return ocgoApi.refresh().then((fresh) => {
						setView(fresh);
					}, () => {});
				}, () => {
					setBusy(false);
					setNotice({
						kind: "err",
						text: tRef.current("ocgo.saveFailed")
					});
				});
			}, [adopt]);
			/** Drop the local override so the credentials seam supplies the key again. */
			const clear = (0, react.useCallback)(() => {
				setBusy(true);
				setNotice(null);
				ocgoApi.writeConfig({ apiKey: null }).then((snapshot) => {
					adopt(snapshot);
					setBusy(false);
					setNotice({
						kind: "ok",
						text: tRef.current("ocgo.cleared")
					});
					notifyConfigChanged();
					return ocgoApi.refresh().then((fresh) => {
						setView(fresh);
					}, () => {});
				}, () => {
					setBusy(false);
					setNotice({
						kind: "err",
						text: tRef.current("ocgo.saveFailed")
					});
				});
			}, [adopt]);
			/** Re-query the gateway with whatever key is currently in effect. */
			const test = (0, react.useCallback)(() => {
				setBusy(true);
				setNotice(null);
				ocgoApi.refresh().then((snapshot) => {
					setView(snapshot);
					setBusy(false);
					setNotice(snapshot.error !== void 0 ? {
						kind: "err",
						text: tRef.current("ocgo.error", { code: snapshot.error })
					} : snapshot.stale === true ? {
						kind: "stale",
						text: tRef.current("ocgo.stale")
					} : {
						kind: "ok",
						text: tRef.current("ocgo.testOk")
					});
				}, () => {
					setBusy(false);
					setNotice({
						kind: "err",
						text: tRef.current("ocgo.error", { code: "fetch" })
					});
				});
			}, []);
			/** Persist one visibility mode; the composer chip picks it up immediately. */
			const setVisibility = (0, react.useCallback)((mode) => {
				if (configRef.current?.visibility === mode) return;
				setBusy(true);
				setNotice(null);
				ocgoApi.writeConfig({ visibility: mode }).then((snapshot) => {
					adopt(snapshot);
					setBusy(false);
					setNotice({
						kind: "ok",
						text: tRef.current("ocgo.visSaved")
					});
					notifyConfigChanged();
				}, () => {
					setBusy(false);
					setNotice({
						kind: "err",
						text: tRef.current("ocgo.saveFailed")
					});
				});
			}, [adopt]);
			const t = props.t;
			const windows = view === null ? [] : [
				view.rolling,
				view.weekly,
				view.monthly
			].filter((w) => w !== void 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ocgo_module_css_default.section,
				"data-testid": "ocgo-settings",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: ocgo_module_css_default.sectionTitle,
						children: t("ocgo.settingsTitle")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ocgo_module_css_default.sectionIntro,
						children: t("ocgo.settingsIntro")
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ocgo_module_css_default.card,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ocgo_module_css_default.cardTitle,
								children: t("ocgo.currentUsage")
							}),
							view === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ocgo_module_css_default.hint,
								children: t("ocgo.error", { code: "fetch" })
							}) : view.error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ocgo_module_css_default.noticeErr,
								children: view.message ?? t("ocgo.error", { code: view.error })
							}) : windows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ocgo_module_css_default.hint,
								children: t("ocgo.unavailable")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ocgo_module_css_default.usageList,
								children: windows.map((w) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ocgo_module_css_default.usageRow,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ocgo_module_css_default.usageLabel,
										children: w.status === "rate-limited" ? t("ocgo.rateLimited") : t(WINDOW_TITLE_KEYS[w.kind])
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: ocgo_module_css_default.usageValue,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: severityClass(w),
											children: [w.percent, "%"]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: ocgo_module_css_default.usageReset,
											children: t("ocgo.resetsIn", { duration: formatDuration(resetInSec(w)) })
										})]
									})]
								}, w.kind))
							}),
							view?.updatedAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ocgo_module_css_default.hint,
								children: t("ocgo.fetchedAt", { time: formatClock(view.updatedAt) })
							}),
							view?.stale === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ocgo_module_css_default.staleHint,
								"data-testid": "ocgo-settings-stale",
								children: t("ocgo.stale")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ocgo_module_css_default.card,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ocgo_module_css_default.cardTitle,
							children: t("ocgo.visibility")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ocgo_module_css_default.options,
							role: "radiogroup",
							"aria-label": t("ocgo.visibility"),
							children: VISIBILITY_OPTIONS.map((mode) => {
								const active = config?.visibility === mode;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "radio",
									"aria-checked": active,
									disabled: busy || config === null,
									className: active ? `${ocgo_module_css_default.option} ${ocgo_module_css_default.optionActive}` : ocgo_module_css_default.option,
									"data-testid": `ocgo-visibility-${mode}`,
									onClick: () => {
										setVisibility(mode);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ocgo_module_css_default.optionLabel,
										children: t(VISIBILITY_LABELS[mode])
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ocgo_module_css_default.optionHint,
										children: t(VISIBILITY_HINTS[mode])
									})]
								}, mode);
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ocgo_module_css_default.card,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ocgo_module_css_default.cardTitle,
								children: t("ocgo.credentials")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ocgo_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ocgo_module_css_default.label,
									children: t("ocgo.apiKey")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: ocgo_module_css_default.input,
									value: keyDraft,
									placeholder: "sk-…",
									spellCheck: false,
									autoComplete: "off",
									"data-testid": "ocgo-settings-key",
									onChange: (e) => {
										setNotice(null);
										setKeyDraft(e.target.value);
									},
									onFocus: (e) => {
										if (e.target.value === maskedText(config?.apiKey)) e.target.select();
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ocgo_module_css_default.hint,
								children: config?.source === void 0 ? t("ocgo.keyMissing") : t("ocgo.keySource", { source: config.source })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ocgo_module_css_default.hint,
								children: t("ocgo.credentialsHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ocgo_module_css_default.actions,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: ocgo_module_css_default.primary,
										onClick: save,
										disabled: busy,
										"data-testid": "ocgo-settings-save",
										children: busy ? t("ocgo.working") : t("ocgo.save")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: ocgo_module_css_default.secondary,
										onClick: test,
										disabled: busy,
										"data-testid": "ocgo-settings-test",
										children: t("ocgo.test")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: ocgo_module_css_default.secondary,
										onClick: clear,
										disabled: busy,
										"data-testid": "ocgo-settings-clear",
										children: t("ocgo.clear")
									}),
									notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: notice.kind === "ok" ? ocgo_module_css_default.noticeOk : notice.kind === "stale" ? ocgo_module_css_default.staleHint : ocgo_module_css_default.noticeErr,
										"data-testid": "ocgo-settings-notice",
										children: notice.text
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ocgo_module_css_default.warn,
								children: t("ocgo.securityNote")
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/model-provider.ts
		/**
		* Resolve this Session's model-directory store, tolerating every failure.
		* @param ctx - a client context able to resolve services.
		* @param sessionId - the Session whose selection decides visibility.
		* @returns the store, or undefined when the service or the Session is absent.
		*/
		function directoryOf(ctx, sessionId) {
			try {
				return ctx.get("modelDirectories")?.directoryFor(sessionId)?.store;
			} catch {
				return;
			}
		}
		/**
		* Build the provider probe for one Session.
		* @param ctx - a client context able to resolve services.
		* @param sessionId - the Session whose selection decides visibility.
		* @returns the probe; every member answers "unknown" without the service.
		*/
		function createProviderProbe(ctx, sessionId) {
			return {
				read: () => {
					const store = directoryOf(ctx, sessionId);
					if (store === void 0) return void 0;
					try {
						const state = store.getSnapshot();
						const provider = (state.pending ?? state.current)?.provider;
						return typeof provider === "string" && provider.length > 0 ? provider : void 0;
					} catch {
						return;
					}
				},
				subscribe: (listener) => {
					const store = directoryOf(ctx, sessionId);
					if (store === void 0) return () => {};
					try {
						return store.subscribe(listener);
					} catch {
						return () => {};
					}
				}
			};
		}
		//#endregion
		//#region src/client/settings-nav-icon.ts
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
		const NAV_ICON_MARKER = "data-ocgo-nav-icon";
		/**
		* The nav rows of the settings dialog. The shell renders each
		* `settings.section` entry as a `<button>` inside the panel's `<nav>`
		* (`SettingsPanel` in `dsh-client-ui-settings-general`), and the dialog is
		* portalled into the body, which is why the observer watches the body.
		*/
		const NAV_ROW_SELECTOR = "[role=\"dialog\"] nav button";
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
		function isOwnNavRow(rowText, wantedLabel) {
			const wanted = String(wantedLabel ?? "").trim();
			if (wanted.length === 0) return false;
			return String(rowText ?? "").trim() === wanted;
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
		function hasDirectGlyphSlot(row) {
			const children = row?.children;
			if (children === void 0 || children === null) return false;
			for (let index = 0; index < children.length; index += 1) if (String(children[index]?.tagName ?? "").toLowerCase() === "svg") return true;
			return false;
		}
		/**
		* Stylesheet for the marked row: hide the shell's gear, draw the mark.
		* @param maskUrl - the mark's data URL.
		* @returns the CSS text of the owned `<style>` element.
		*/
		function navIconCss(maskUrl) {
			return [
				`[${NAV_ICON_MARKER}] > svg { display: none; }`,
				`[${NAV_ICON_MARKER}]::before {`,
				`  content: '';`,
				`  flex: none;`,
				`  width: 16px;`,
				`  height: 16px;`,
				`  background-color: currentColor;`,
				`  -webkit-mask-image: url("${maskUrl}");`,
				`  mask-image: url("${maskUrl}");`,
				`  -webkit-mask-repeat: no-repeat;`,
				`  mask-repeat: no-repeat;`,
				`  -webkit-mask-position: center;`,
				`  mask-position: center;`,
				`  -webkit-mask-size: 16px 16px;`,
				`  mask-size: 16px 16px;`,
				`}`
			].join("\n");
		}
		/**
		* Install the nav glyph.
		* @param ctx - client context, for effect ownership.
		* @param resolveLabel - this plugin's current section label (the same thunk the
		*   `settings.section` registration passes), re-read on every sync so the glyph
		*   and the row text can never disagree.
		*/
		function installSettingsNavIcon(ctx, resolveLabel) {
			if (typeof document === "undefined") return;
			const doc = document;
			ctx.effect(() => {
				const tag = doc.createElement("style");
				tag.dataset.plugin = "@sutong12/dsh-opencode-go-usage";
				tag.dataset.pluginCss = "@sutong12/dsh-opencode-go-usage/settings-nav-icon";
				tag.textContent = navIconCss(ocgoMaskUrl());
				doc.head.appendChild(tag);
				let disposed = false;
				let scheduled = false;
				const sync = () => {
					scheduled = false;
					if (disposed) return;
					const wanted = resolveLabel();
					for (const row of Array.from(doc.querySelectorAll(NAV_ROW_SELECTOR))) if (isOwnNavRow(row.textContent, wanted) && hasDirectGlyphSlot(row)) row.setAttribute(NAV_ICON_MARKER, "");
					else row.removeAttribute(NAV_ICON_MARKER);
				};
				const schedule = () => {
					if (scheduled || disposed) return;
					scheduled = true;
					queueMicrotask(sync);
				};
				sync();
				const observer = new MutationObserver(schedule);
				observer.observe(doc.body, {
					childList: true,
					subtree: true,
					characterData: true
				});
				return () => {
					disposed = true;
					observer.disconnect();
					for (const row of Array.from(doc.querySelectorAll(`[${NAV_ICON_MARKER}]`))) row.removeAttribute(NAV_ICON_MARKER);
					tag.remove();
				};
			}, "@sutong12/dsh-opencode-go-usage: settings nav icon");
		}
		//#endregion
		//#region src/client/locales.ts
		/** Chinese copy. */
		const zh = {
			"ocgo.unavailable": "用量不可用",
			"ocgo.error": "查询失败：{code}",
			"ocgo.noconfig": "未配置：请在「设置 → OpenCode Go 用量」里填入 API key，或设置 OPENCODE_GO_API_KEY",
			"ocgo.refresh": "刷新",
			"ocgo.fetchedAt": "upd {time}",
			"ocgo.stale": "本次访问超时，展示的是上一轮的数据",
			"ocgo.rolling": "5h 滚动",
			"ocgo.weekly": "每周",
			"ocgo.monthly": "每月",
			"ocgo.rateLimited": "已限流",
			"ocgo.resetsIn": "剩余 {duration}",
			"ocgo.expand": "展开用量详情",
			"ocgo.collapse": "收起",
			"ocgo.sep": "·",
			"ocgo.set": "设置",
			"ocgo.save": "保存",
			"ocgo.apiKey": "API key",
			"ocgo.setHint": "点击外部或按 Esc 保存",
			"ocgo.settingsNav": "OpenCode Go",
			"ocgo.settingsTitle": "OpenCode Go 用量",
			"ocgo.settingsIntro": "用量直接读取 OpenCode Go 的 /usage 接口，用的是你选模型时同一个 API key —— 不再需要浏览器 cookie。",
			"ocgo.credentials": "取数凭证",
			"ocgo.keySource": "当前生效的 key 来自：{source}",
			"ocgo.keyMissing": "当前没有可用的 key：凭据库里没有，也没有本地覆盖。",
			"ocgo.credentialsHint": "这里填写的 key 会写入 $DSH_HOME/ocgo-usage.json 并优先使用；清除后回退到 DSH 凭据库里的 OPENCODE_GO_API_KEY / OPENCODE_API_KEY。",
			"ocgo.currentUsage": "当前用量",
			"ocgo.test": "测试连接",
			"ocgo.working": "处理中…",
			"ocgo.saved": "已保存",
			"ocgo.cleared": "已清除本地覆盖，回退到凭据库",
			"ocgo.saveFailed": "保存失败",
			"ocgo.loadFailed": "读取配置失败",
			"ocgo.noChanges": "没有改动",
			"ocgo.testOk": "连接正常",
			"ocgo.clear": "清除",
			"ocgo.securityNote": "API key 等同于账号凭据。它只保存在 host 侧，页面永远只看到末尾 4 位的掩码。",
			"ocgo.visibility": "输入框展示",
			"ocgo.visAlways": "常驻展示用量",
			"ocgo.visAlwaysHint": "只要配置了 key 就显示，与当前用哪个模型无关",
			"ocgo.visProvider": "使用 opencode-go 才展示",
			"ocgo.visProviderHint": "仅当前模型走 opencode-go provider 时显示",
			"ocgo.visNever": "不展示用量",
			"ocgo.visNeverHint": "输入框不显示；本设置页仍可查看",
			"ocgo.visSaved": "已更新显示方式"
		};
		/** English copy. */
		const en = {
			"ocgo.unavailable": "usage unavailable",
			"ocgo.error": "Query failed: {code}",
			"ocgo.noconfig": "Not configured: paste an API key in Settings → OpenCode Go usage, or set OPENCODE_GO_API_KEY",
			"ocgo.refresh": "Refresh",
			"ocgo.fetchedAt": "upd {time}",
			"ocgo.stale": "This access timed out — showing the previous round",
			"ocgo.rolling": "5h Rolling",
			"ocgo.weekly": "Weekly",
			"ocgo.monthly": "Monthly",
			"ocgo.rateLimited": "rate-limited",
			"ocgo.resetsIn": "resets in {duration}",
			"ocgo.expand": "Show usage details",
			"ocgo.collapse": "Collapse",
			"ocgo.sep": "·",
			"ocgo.set": "Set",
			"ocgo.save": "Save",
			"ocgo.apiKey": "API key",
			"ocgo.setHint": "click outside or press Esc to save",
			"ocgo.settingsNav": "OpenCode Go",
			"ocgo.settingsTitle": "OpenCode Go usage",
			"ocgo.settingsIntro": "Usage is read straight from the OpenCode Go /usage API with the same API key your model selection uses — no browser cookie involved.",
			"ocgo.credentials": "Fetch credential",
			"ocgo.keySource": "The effective key comes from: {source}",
			"ocgo.keyMissing": "No usable key: neither the credentials store nor a local override supplies one.",
			"ocgo.credentialsHint": "A key pasted here is stored in $DSH_HOME/ocgo-usage.json and takes precedence; clearing it falls back to OPENCODE_GO_API_KEY / OPENCODE_API_KEY in the DSH credentials store.",
			"ocgo.currentUsage": "Current usage",
			"ocgo.test": "Test connection",
			"ocgo.working": "Working…",
			"ocgo.saved": "Saved",
			"ocgo.cleared": "Local override cleared; falling back to the credentials store",
			"ocgo.saveFailed": "Save failed",
			"ocgo.loadFailed": "Could not read the configuration",
			"ocgo.noChanges": "No changes",
			"ocgo.testOk": "Connection OK",
			"ocgo.clear": "Clear",
			"ocgo.securityNote": "The API key is an account credential. It stays host-side; the page only ever sees the last-4 mask.",
			"ocgo.visibility": "Composer display",
			"ocgo.visAlways": "Always show usage",
			"ocgo.visAlwaysHint": "Shown whenever a key is configured, whichever model is selected",
			"ocgo.visProvider": "Only while using opencode-go",
			"ocgo.visProviderHint": "Shown only when the current model runs on the opencode-go provider",
			"ocgo.visNever": "Never show usage",
			"ocgo.visNeverHint": "Hidden from the composer; this settings page still reports it",
			"ocgo.visSaved": "Display mode updated"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "ocgo";
		/** Required services: slots for the composer tool-row entry, locale for the copy. */
		const inject = ["slots", "locale"];
		/**
		* One stable probe per session. The slot inject factory may run on every render,
		* and a fresh probe identity would make React resubscribe each time; the cache
		* also keeps the subscription's identity stable. Probes are tiny (a context
		* reference and a session id) and a composition holds few sessions.
		*/
		const probes = /* @__PURE__ */ new Map();
		/**
		* Resolve the probe for one session, minting it on first use.
		* @param lookup - the client context, seen as a service lookup.
		* @param sessionId - the session whose selection decides visibility.
		* @returns the cached probe.
		*/
		function probeFor(lookup, sessionId) {
			let probe = probes.get(sessionId);
			if (probe === void 0) {
				probe = createProviderProbe(lookup, sessionId);
				probes.set(sessionId, probe);
			}
			return probe;
		}
		/**
		* Register the usage chip into the composer tool row next to the model selector.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "@sutong12/dsh-opencode-go-usage: dictionaries");
			const nav = ctx.locale.bind(NS);
			const sectionLabel = () => nav("ocgo.settingsNav");
			installSettingsNavIcon(ctx, sectionLabel);
			const settingsSlots = ctx.slots;
			settingsSlots.inject("settings.section", () => settingsSlots.register({
				name: "settings.section",
				id: "ocgo-usage",
				order: 25,
				label: sectionLabel,
				locale: NS
			}, OcgoSettingsSection));
			ctx.inject(["slots", "conversation"], (scope) => {
				const lookup = scope;
				scope.effect(() => scope.slots.register({
					name: "conversation.input.right",
					id: "ocgo-usage",
					order: 110,
					locale: NS,
					inject: (sessionId) => ({
						dockSessionId: sessionId,
						...sessionId === void 0 ? {} : { provider: probeFor(lookup, sessionId) }
					})
				}, OcgoDockEntry), "@sutong12/dsh-opencode-go-usage: chip registration");
			});
		}
		//#endregion
		exports.OCGO_PROVIDER = OCGO_PROVIDER;
		exports.OcgoDockEntry = OcgoDockEntry;
		exports.apply = apply;
		exports.formatDuration = formatDuration;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map