import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
 * @module dsh-ocgo-usage/client/OcgoDockEntry
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { chipVisible } from "../provider.js";
import { onConfigChanged } from "./config-bus.js";
import { OCGO_MARK_DARK_BG, OCGO_MARK_INK, OCGO_MARK_PATHS, OCGO_MARK_VIEW_BOX } from "./ocgo-mark.js";
import { maskedText, ocgoApi } from "./host-api.js";
import { formatClock, formatDuration, resetInSec, severityClass, WINDOW_LABELS, WINDOW_TITLE_KEYS } from "./windows.js";
import css from './ocgo.module.css';
/** Poll interval for the host usage snapshot. The provider gate does not wait
 * for it: the model-selection store notifies this component directly. */
const POLL_MS = 10_000;
/** A disposer that does nothing, for a probe that could not subscribe. */
const NOOP = () => { };
// The window labels, the duration/clock formatters and the severity ramp now
// live in ./windows.ts so the settings page renders identical numbers.
// `formatDuration` stays re-exported below: this module's published surface is
// unchanged.
export { formatDuration } from "./windows.js";
/** Detect dark mode via DSH body attribute. */
function useDarkMode() {
    const [dark, setDark] = useState(() => {
        if (typeof document === 'undefined')
            return false;
        return document.body.hasAttribute('data-ds-dark-theme');
    });
    useEffect(() => {
        const el = document.body;
        if (!el)
            return;
        const observer = new MutationObserver(() => {
            setDark(el.hasAttribute('data-ds-dark-theme'));
        });
        observer.observe(el, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
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
    return (_jsxs("svg", { className: css.logo, width: "22", height: "12", viewBox: OCGO_MARK_VIEW_BOX, fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", children: [dark && _jsx("rect", { width: "100%", height: "100%", fill: OCGO_MARK_DARK_BG }), OCGO_MARK_PATHS.map((path) => _jsx("path", { d: path.d, fill: ink[path.tone] }, path.d))] }));
}
/** Render one window segment: compact `· 5h 23%`, full `· 5h 23% (3h 25m)`. */
function WindowSegment(props) {
    const { window, sep, compact = false } = props;
    const cls = severityClass(window);
    return (_jsxs("span", { className: css.seg, children: [_jsx("span", { className: css.segSep, children: sep }), _jsxs("span", { className: cls ?? undefined, children: [WINDOW_LABELS[window.kind], " ", window.percent, "%", !compact ? ` (${formatDuration(resetInSec(window))})` : ''] })] }));
}
/**
 * The OpenCode Go usage chip: polls the host snapshot, renders the three
 * windows inline, and expands into a detail panel on click.
 * @param props - the composed dock entry props.
 */
export function OcgoDockEntry(props) {
    const [view, setView] = useState(null);
    const [answered, setAnswered] = useState(false);
    // The last poll could not reach the host (timeout / transport failure): the
    // previous round stays on screen, flagged, instead of blanking into an error.
    const [unreachable, setUnreachable] = useState(false);
    const [open, setOpen] = useState(false);
    // Panel mode: 'view' = windows + footer; 'set' = API-key editor.
    const [mode, setMode] = useState('view');
    const [config, setConfig] = useState(null);
    const [keyDraft, setKeyDraft] = useState('');
    const wrapRef = useRef(null);
    const modeRef = useRef('view');
    modeRef.current = mode;
    const draftsRef = useRef({ key: '' });
    draftsRef.current = { key: keyDraft };
    const configRef = useRef(null);
    configRef.current = config;
    // The provider gate reads the very store the model selector renders from:
    // synchronous, in-memory, and notified on every selection change — so picking
    // a model lands here at once instead of on the next poll.
    const probe = props.provider;
    const subscribeProvider = useCallback((onChange) => (probe === undefined ? NOOP : probe.subscribe(onChange)), [probe]);
    const readProvider = useCallback(() => probe?.read(), [probe]);
    const provider = useSyncExternalStore(subscribeProvider, readProvider);
    /** One periodic tick: read the host's usage snapshot. */
    const pollNow = useCallback(() => {
        let live = true;
        ocgoApi.view().then((snapshot) => {
            if (!live)
                return;
            setView(snapshot);
            setUnreachable(false);
            setAnswered(true);
        }, () => {
            if (!live)
                return;
            // One unreachable access is not a reason to throw away the last round:
            // keep whatever is on screen and flag it as stale. Only a poll that has
            // never succeeded falls through to the error chip below.
            setUnreachable(true);
            setAnswered(true);
        });
        return () => { live = false; };
    }, []);
    useEffect(() => {
        const cleanup = pollNow();
        const timer = window.setInterval(pollNow, POLL_MS);
        const onVisibility = () => {
            if (document.visibilityState === 'visible')
                pollNow();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            cleanup();
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [pollNow]);
    // A config write made in this bundle (Settings → OpenCode Go) reaches the chip
    // at once instead of on the next tick. The provider gate needs no such signal:
    // the model-selection store pushes to it directly.
    useEffect(() => onConfigChanged(pollNow), [pollNow]);
    /** Load the masked config into the editor drafts. */
    const loadConfig = useCallback(() => {
        ocgoApi.config().then((snapshot) => {
            setConfig(snapshot);
            setKeyDraft(maskedText(snapshot.apiKey));
        }, () => {
            // Editor still opens; the draft stays empty.
            setConfig(null);
            setKeyDraft('');
        });
    }, []);
    /** Submit any edited field; returns the write promise (fire-and-forget on blur). */
    const saveConfig = useCallback(() => {
        const baseline = configRef.current;
        const partial = {};
        const key = draftsRef.current.key.trim();
        if (key.length > 0 && key !== maskedText(baseline?.apiKey))
            partial.apiKey = key;
        if (Object.keys(partial).length === 0)
            return;
        ocgoApi.writeConfig(partial).then((snapshot) => {
            setConfig(snapshot);
            setKeyDraft(maskedText(snapshot.apiKey));
            // The new key is live now (host invalidated its cache): poll now.
            pollNow();
        }, () => {
            // Ignore; the next poll resyncs and the editor keeps the draft.
        });
    }, [pollNow]);
    /** Close the panel; in set mode a blur/close acts as confirm (save). */
    const closePanel = useCallback(() => {
        if (modeRef.current === 'set')
            saveConfig();
        setOpen(false);
        setMode('view');
    }, [saveConfig]);
    /** Open the editor (used by the Set button and the error chip). */
    const openSet = useCallback(() => {
        setMode('set');
        setOpen(true);
        loadConfig();
    }, [loadConfig]);
    // Close the detail panel when focus leaves the chip: any pointer press
    // outside the wrapper, or Escape. In set mode this CONFIRMS (saves).
    useEffect(() => {
        if (!open)
            return;
        const onPointerDown = (event) => {
            const target = event.target;
            if (target !== null && wrapRef.current !== null && !wrapRef.current.contains(target)) {
                closePanel();
            }
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                closePanel();
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open, closePanel]);
    const refresh = () => {
        ocgoApi.refresh().then((snapshot) => {
            setView(snapshot);
            setUnreachable(false);
        }, () => {
            // Keep the previous round on screen instead of erroring out; the next
            // poll resyncs once the host answers again.
            setUnreachable(true);
        });
    };
    const t = props.t;
    const sep = ` ${t('ocgo.sep')} `;
    // Nothing before the host's first answer. Then the mode the host reports is
    // applied to the live provider read above, and the two states that have
    // nothing to say in the composer are dropped outright.
    if (!answered)
        return null;
    if (view !== null && (view.error === 'noconfig' || view.error === 'disabled'))
        return null;
    if (!chipVisible(view?.visibility ?? 'always', provider))
        return null;
    const error = view === null ? { code: 'fetch', message: t('ocgo.error', { code: 'fetch' }) }
        : view.error !== undefined
            ? { code: view.error, message: view.message ?? t('ocgo.error', { code: view.error }) }
            : null;
    // Error state: the chip opens the Set editor directly so a rejected key can
    // be replaced in place; clicking outside (or Esc) confirms the write.
    if (error !== null) {
        return (_jsxs("span", { className: css.wrap, ref: wrapRef, "data-testid": "ocgo-chip-error", children: [_jsxs("button", { type: "button", className: open ? `${css.chip} ${css.chipOpen}` : css.chip, onClick: () => { if (open)
                        closePanel();
                    else
                        openSet(); }, title: `${error.message}\n${t('ocgo.set')}`, children: [_jsx(OcgoLogo, {}), " <err:", error.code, ">"] }), open && (_jsx("span", { className: css.details, children: _jsxs("span", { className: css.setPanel, children: [_jsxs("label", { className: css.field, children: [_jsx("span", { className: css.fieldLabel, children: t('ocgo.apiKey') }), _jsx("input", { className: css.fieldInput, value: keyDraft, placeholder: "sk-\u2026", spellCheck: false, autoComplete: "off", onChange: (e) => { setKeyDraft(e.target.value); }, onFocus: (e) => { if (e.target.value === maskedText(config?.apiKey))
                                            e.target.select(); } })] }), _jsxs("span", { className: css.foot, children: [_jsx("span", { className: css.setHint, children: t('ocgo.setHint') }), _jsx("button", { type: "button", className: css.refreshBtn, onClick: closePanel, children: t('ocgo.save') })] })] }) }))] }));
    }
    // TS: after the error early-return, `view` is a non-null success snapshot.
    const snapshot = view;
    // Stale when the host already flagged its read as a surviving round, or when
    // this browser could not reach it and is showing what the last round produced.
    const stale = unreachable || snapshot.stale === true;
    const windows = [
        snapshot.rolling,
        snapshot.weekly,
        snapshot.monthly,
    ].filter((w) => w !== undefined);
    // No windows at all (e.g. brand-new account): show unavailable, refreshable.
    if (windows.length === 0) {
        return (_jsxs("button", { type: "button", className: css.chip, onClick: refresh, title: t('ocgo.refresh'), "data-testid": "ocgo-chip-empty", children: [_jsx(OcgoLogo, {}), " ", t('ocgo.unavailable')] }));
    }
    return (_jsxs("span", { className: css.wrap, ref: wrapRef, "data-testid": "ocgo-chip", "data-stale": stale || undefined, children: [_jsxs("button", { type: "button", className: open ? `${css.chip} ${css.chipOpen}` : css.chip, onClick: () => { if (open)
                    closePanel();
                else
                    setOpen(true); }, title: stale ? t('ocgo.stale') : (open ? t('ocgo.collapse') : t('ocgo.expand')), children: [_jsx(OcgoLogo, {}), windows.map((w) => (_jsx(WindowSegment, { window: w, sep: sep, compact: true }, w.kind))), _jsx("span", { className: open ? `${css.chevron} ${css.chevronOpen}` : css.chevron, "aria-hidden": "true", children: _jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", children: _jsx("path", { d: "M3 4.5L6 7.5L9 4.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) }) })] }), open && (_jsx("span", { className: css.details, children: mode === 'set' ? (_jsxs("span", { className: css.setPanel, children: [_jsxs("label", { className: css.field, children: [_jsx("span", { className: css.fieldLabel, children: t('ocgo.apiKey') }), _jsx("input", { className: css.fieldInput, value: keyDraft, placeholder: "sk-\u2026", spellCheck: false, autoComplete: "off", onChange: (e) => { setKeyDraft(e.target.value); }, onFocus: (e) => { if (e.target.value === maskedText(config?.apiKey))
                                        e.target.select(); } })] }), _jsxs("span", { className: css.foot, children: [_jsx("span", { className: css.setHint, children: t('ocgo.setHint') }), _jsx("button", { type: "button", className: css.refreshBtn, onClick: closePanel, children: t('ocgo.save') })] })] })) : (_jsxs(_Fragment, { children: [windows.map((w) => (_jsxs("span", { className: css.window, children: [_jsx("span", { className: css.windowLabel, children: w.status === 'rate-limited' ? t('ocgo.rateLimited') : t(WINDOW_TITLE_KEYS[w.kind]) }), _jsxs("span", { className: css.windowValue, children: [_jsxs("span", { className: severityClass(w) ?? undefined, children: [w.percent, "%"] }), _jsx("span", { className: css.windowReset, children: t('ocgo.resetsIn', { duration: formatDuration(resetInSec(w)) }) })] })] }, w.kind))), _jsxs("span", { className: css.foot, children: [_jsx("button", { type: "button", className: css.setBtn, onClick: openSet, children: t('ocgo.set') }), _jsxs("span", { className: css.footRight, children: [_jsx("button", { type: "button", className: css.refreshBtn, onClick: refresh, children: t('ocgo.refresh') }), snapshot.updatedAt !== undefined && (_jsx("span", { className: stale ? `${css.fetchedAt} ${css.fetchedStale}` : css.fetchedAt, title: stale ? t('ocgo.stale') : undefined, children: t('ocgo.fetchedAt', { time: formatClock(snapshot.updatedAt) }) }))] })] })] })) }))] }));
}
