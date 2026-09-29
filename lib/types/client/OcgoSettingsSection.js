import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
 * @module dsh-ocgo-usage/client/OcgoSettingsSection
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { maskedText, ocgoApi } from "./host-api.js";
import { formatClock, formatDuration, resetInSec, severityClass, WINDOW_TITLE_KEYS } from "./windows.js";
import css from './ocgo.module.css';
/** The visibility modes, in presentation order. */
const VISIBILITY_OPTIONS = ['always', 'provider', 'never'];
/** Option label keys, one per mode. */
const VISIBILITY_LABELS = {
    always: 'ocgo.visAlways',
    provider: 'ocgo.visProvider',
    never: 'ocgo.visNever',
};
/** Option hint keys, one per mode. */
const VISIBILITY_HINTS = {
    always: 'ocgo.visAlwaysHint',
    provider: 'ocgo.visProviderHint',
    never: 'ocgo.visNeverHint',
};
/**
 * The OpenCode Go usage settings page.
 * @param props - the composed settings-section props.
 * @returns the section content.
 */
export function OcgoSettingsSection(props) {
    const [config, setConfig] = useState(null);
    const [view, setView] = useState(null);
    const [keyDraft, setKeyDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);
    // `t` is read through a ref so the one-shot load effect can depend on
    // nothing: a locale sweep re-renders with fresh copy without re-fetching.
    const tRef = useRef(props.t);
    tRef.current = props.t;
    const configRef = useRef(null);
    configRef.current = config;
    const draftRef = useRef('');
    draftRef.current = keyDraft;
    /** Adopt one masked snapshot as both the diff baseline and the field draft. */
    const adopt = useCallback((snapshot) => {
        setConfig(snapshot);
        setKeyDraft(maskedText(snapshot.apiKey));
    }, []);
    /** Read the masked credential view and the current usage snapshot. */
    const load = useCallback(() => {
        ocgoApi.config().then(adopt, () => {
            setNotice({ kind: 'err', text: tRef.current('ocgo.loadFailed') });
        });
        ocgoApi.view().then((snapshot) => { setView(snapshot); }, () => { setView(null); });
    }, [adopt]);
    useEffect(() => { load(); }, [load]);
    /**
     * Write the pasted key only when its text differs from the masked baseline,
     * then re-query so the page shows the numbers that credential actually yields.
     */
    const save = useCallback(() => {
        const key = draftRef.current.trim();
        if (key.length === 0 || key === maskedText(configRef.current?.apiKey)) {
            setNotice({ kind: 'err', text: tRef.current('ocgo.noChanges') });
            return;
        }
        setBusy(true);
        setNotice(null);
        ocgoApi.writeConfig({ apiKey: key }).then((snapshot) => {
            adopt(snapshot);
            setBusy(false);
            setNotice({ kind: 'ok', text: tRef.current('ocgo.saved') });
            return ocgoApi.refresh().then((fresh) => { setView(fresh); }, () => { setView(null); });
        }, () => {
            setBusy(false);
            setNotice({ kind: 'err', text: tRef.current('ocgo.saveFailed') });
        });
    }, [adopt]);
    /** Drop the local override so the credentials seam supplies the key again. */
    const clear = useCallback(() => {
        setBusy(true);
        setNotice(null);
        ocgoApi.writeConfig({ apiKey: null })
            .then((snapshot) => {
            adopt(snapshot);
            setBusy(false);
            setNotice({ kind: 'ok', text: tRef.current('ocgo.cleared') });
            return ocgoApi.refresh().then((fresh) => { setView(fresh); }, () => { setView(null); });
        }, () => {
            setBusy(false);
            setNotice({ kind: 'err', text: tRef.current('ocgo.saveFailed') });
        });
    }, [adopt]);
    /** Re-query the gateway with whatever key is currently in effect. */
    const test = useCallback(() => {
        setBusy(true);
        setNotice(null);
        ocgoApi.refresh().then((snapshot) => {
            setView(snapshot);
            setBusy(false);
            setNotice(snapshot.error === undefined
                ? { kind: 'ok', text: tRef.current('ocgo.testOk') }
                : { kind: 'err', text: tRef.current('ocgo.error', { code: snapshot.error }) });
        }, () => {
            setBusy(false);
            setNotice({ kind: 'err', text: tRef.current('ocgo.error', { code: 'fetch' }) });
        });
    }, []);
    /** Persist one visibility mode; the composer picks it up on its next poll. */
    const setVisibility = useCallback((mode) => {
        if (configRef.current?.visibility === mode)
            return;
        setBusy(true);
        setNotice(null);
        ocgoApi.writeConfig({ visibility: mode }).then((snapshot) => {
            adopt(snapshot);
            setBusy(false);
            setNotice({ kind: 'ok', text: tRef.current('ocgo.visSaved') });
        }, () => {
            setBusy(false);
            setNotice({ kind: 'err', text: tRef.current('ocgo.saveFailed') });
        });
    }, [adopt]);
    const t = props.t;
    const windows = view === null
        ? []
        : [view.rolling, view.weekly, view.monthly].filter((w) => w !== undefined);
    return (_jsxs("div", { className: css.section, "data-testid": "ocgo-settings", children: [_jsxs("div", { children: [_jsx("h2", { className: css.sectionTitle, children: t('ocgo.settingsTitle') }), _jsx("p", { className: css.sectionIntro, children: t('ocgo.settingsIntro') })] }), _jsxs("div", { className: css.card, children: [_jsx("div", { className: css.cardTitle, children: t('ocgo.currentUsage') }), view === null ? (_jsx("p", { className: css.hint, children: t('ocgo.error', { code: 'fetch' }) })) : view.error !== undefined ? (_jsx("p", { className: css.noticeErr, children: view.message ?? t('ocgo.error', { code: view.error }) })) : windows.length === 0 ? (_jsx("p", { className: css.hint, children: t('ocgo.unavailable') })) : (_jsx("div", { className: css.usageList, children: windows.map((w) => (_jsxs("div", { className: css.usageRow, children: [_jsx("span", { className: css.usageLabel, children: w.status === 'rate-limited' ? t('ocgo.rateLimited') : t(WINDOW_TITLE_KEYS[w.kind]) }), _jsxs("span", { className: css.usageValue, children: [_jsxs("span", { className: severityClass(w), children: [w.percent, "%"] }), _jsx("span", { className: css.usageReset, children: t('ocgo.resetsIn', { duration: formatDuration(resetInSec(w)) }) })] })] }, w.kind))) })), view?.updatedAt !== undefined && (_jsx("p", { className: css.hint, children: t('ocgo.fetchedAt', { time: formatClock(view.updatedAt) }) }))] }), _jsxs("div", { className: css.card, children: [_jsx("div", { className: css.cardTitle, children: t('ocgo.visibility') }), _jsx("div", { className: css.options, role: "radiogroup", "aria-label": t('ocgo.visibility'), children: VISIBILITY_OPTIONS.map((mode) => {
                            const active = config?.visibility === mode;
                            return (_jsxs("button", { type: "button", role: "radio", "aria-checked": active, disabled: busy || config === null, className: active ? `${css.option} ${css.optionActive}` : css.option, "data-testid": `ocgo-visibility-${mode}`, onClick: () => { setVisibility(mode); }, children: [_jsx("span", { className: css.optionLabel, children: t(VISIBILITY_LABELS[mode]) }), _jsx("span", { className: css.optionHint, children: t(VISIBILITY_HINTS[mode]) })] }, mode));
                        }) })] }), _jsxs("div", { className: css.card, children: [_jsx("div", { className: css.cardTitle, children: t('ocgo.credentials') }), _jsxs("label", { className: css.row, children: [_jsx("span", { className: css.label, children: t('ocgo.apiKey') }), _jsx("input", { className: css.input, value: keyDraft, placeholder: "sk-\u2026", spellCheck: false, autoComplete: "off", "data-testid": "ocgo-settings-key", onChange: (e) => { setNotice(null); setKeyDraft(e.target.value); }, onFocus: (e) => { if (e.target.value === maskedText(config?.apiKey))
                                    e.target.select(); } })] }), _jsx("p", { className: css.hint, children: config?.source === undefined
                            ? t('ocgo.keyMissing')
                            : t('ocgo.keySource', { source: config.source }) }), _jsx("p", { className: css.hint, children: t('ocgo.credentialsHint') }), _jsxs("div", { className: css.actions, children: [_jsx("button", { type: "button", className: css.primary, onClick: save, disabled: busy, "data-testid": "ocgo-settings-save", children: busy ? t('ocgo.working') : t('ocgo.save') }), _jsx("button", { type: "button", className: css.secondary, onClick: test, disabled: busy, "data-testid": "ocgo-settings-test", children: t('ocgo.test') }), _jsx("button", { type: "button", className: css.secondary, onClick: clear, disabled: busy, "data-testid": "ocgo-settings-clear", children: t('ocgo.clear') }), notice !== null && (_jsx("span", { className: notice.kind === 'ok' ? css.noticeOk : css.noticeErr, "data-testid": "ocgo-settings-notice", children: notice.text }))] }), _jsx("p", { className: css.warn, children: t('ocgo.securityNote') })] })] }));
}
