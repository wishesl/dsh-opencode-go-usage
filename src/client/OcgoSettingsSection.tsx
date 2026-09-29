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

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ChipVisibility, MaskedConfigView, OcgoUsageView, UsageWindow } from '../types.ts'
import { NS, type OcgoKey } from './locales.ts'
import { maskedText, ocgoApi } from './host-api.ts'
import { notifyConfigChanged } from './config-bus.ts'
import { formatClock, formatDuration, resetInSec, severityClass, WINDOW_TITLE_KEYS } from './windows.ts'
import css from './ocgo.module.css'

/**
 * Props of the settings page: the shell's owner face plus the locale dictionary.
 *
 * Spelled out rather than as `PropsRuntime<'settings.section'>` on purpose:
 * that key is declared by @deepseek-ai/dsh-client-ui-settings, which this
 * package does not depend on. See the registration note in ./index.ts.
 */
export type OcgoSettingsSectionProps = PropsLocale<typeof NS> & {
  /** Shell affordance for a section that leaves settings (unused by this page). */
  close?: () => void
}

/** One page-local status line under the credential actions. */
interface Notice {
  /** `ok` for a saved/tested state, `err` for a failure or a rejected write. */
  readonly kind: 'ok' | 'err'
  /** Already-localized text. */
  readonly text: string
}

/** The visibility modes, in presentation order. */
const VISIBILITY_OPTIONS: readonly ChipVisibility[] = ['always', 'provider', 'never']

/** Option label keys, one per mode. */
const VISIBILITY_LABELS: Record<ChipVisibility, OcgoKey> = {
  always: 'ocgo.visAlways',
  provider: 'ocgo.visProvider',
  never: 'ocgo.visNever',
}

/** Option hint keys, one per mode. */
const VISIBILITY_HINTS: Record<ChipVisibility, OcgoKey> = {
  always: 'ocgo.visAlwaysHint',
  provider: 'ocgo.visProviderHint',
  never: 'ocgo.visNeverHint',
}

/**
 * The OpenCode Go usage settings page.
 * @param props - the composed settings-section props.
 * @returns the section content.
 */
export function OcgoSettingsSection(props: OcgoSettingsSectionProps): React.ReactElement {
  const [config, setConfig] = useState<MaskedConfigView | null>(null)
  const [view, setView] = useState<OcgoUsageView | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  // `t` is read through a ref so the one-shot load effect can depend on
  // nothing: a locale sweep re-renders with fresh copy without re-fetching.
  const tRef = useRef(props.t)
  tRef.current = props.t
  const configRef = useRef<MaskedConfigView | null>(null)
  configRef.current = config
  const draftRef = useRef('')
  draftRef.current = keyDraft

  /** Adopt one masked snapshot as both the diff baseline and the field draft. */
  const adopt = useCallback((snapshot: MaskedConfigView): void => {
    setConfig(snapshot)
    setKeyDraft(maskedText(snapshot.apiKey))
  }, [])

  /** Read the masked credential view and the current usage snapshot. */
  const load = useCallback((): void => {
    ocgoApi.config().then(adopt, () => {
      setNotice({ kind: 'err', text: tRef.current('ocgo.loadFailed') })
    })
    ocgoApi.view().then((snapshot) => { setView(snapshot) }, () => { setView(null) })
  }, [adopt])

  useEffect(() => { load() }, [load])

  /**
   * Write the pasted key only when its text differs from the masked baseline,
   * then re-query so the page shows the numbers that credential actually yields.
   */
  const save = useCallback((): void => {
    const key = draftRef.current.trim()
    if (key.length === 0 || key === maskedText(configRef.current?.apiKey)) {
      setNotice({ kind: 'err', text: tRef.current('ocgo.noChanges') })
      return
    }
    setBusy(true)
    setNotice(null)
    ocgoApi.writeConfig({ apiKey: key }).then((snapshot) => {
      adopt(snapshot)
      setBusy(false)
      setNotice({ kind: 'ok', text: tRef.current('ocgo.saved') })
      // The composer chip re-reads at once instead of on its next tick.
      notifyConfigChanged()
      return ocgoApi.refresh().then((fresh) => { setView(fresh) }, () => { setView(null) })
    }, () => {
      setBusy(false)
      setNotice({ kind: 'err', text: tRef.current('ocgo.saveFailed') })
    })
  }, [adopt])

  /** Drop the local override so the credentials seam supplies the key again. */
  const clear = useCallback((): void => {
    setBusy(true)
    setNotice(null)
    ocgoApi.writeConfig({ apiKey: null })
      .then((snapshot) => {
        adopt(snapshot)
        setBusy(false)
        setNotice({ kind: 'ok', text: tRef.current('ocgo.cleared') })
        notifyConfigChanged()
        return ocgoApi.refresh().then((fresh) => { setView(fresh) }, () => { setView(null) })
      }, () => {
        setBusy(false)
        setNotice({ kind: 'err', text: tRef.current('ocgo.saveFailed') })
      })
  }, [adopt])

  /** Re-query the gateway with whatever key is currently in effect. */
  const test = useCallback((): void => {
    setBusy(true)
    setNotice(null)
    ocgoApi.refresh().then((snapshot) => {
      setView(snapshot)
      setBusy(false)
      setNotice(snapshot.error === undefined
        ? { kind: 'ok', text: tRef.current('ocgo.testOk') }
        : { kind: 'err', text: tRef.current('ocgo.error', { code: snapshot.error }) })
    }, () => {
      setBusy(false)
      setNotice({ kind: 'err', text: tRef.current('ocgo.error', { code: 'fetch' }) })
    })
  }, [])

  /** Persist one visibility mode; the composer chip picks it up immediately. */
  const setVisibility = useCallback((mode: ChipVisibility): void => {
    if (configRef.current?.visibility === mode) return
    setBusy(true)
    setNotice(null)
    ocgoApi.writeConfig({ visibility: mode }).then((snapshot) => {
      adopt(snapshot)
      setBusy(false)
      setNotice({ kind: 'ok', text: tRef.current('ocgo.visSaved') })
      notifyConfigChanged()
    }, () => {
      setBusy(false)
      setNotice({ kind: 'err', text: tRef.current('ocgo.saveFailed') })
    })
  }, [adopt])

  const t = props.t
  const windows: UsageWindow[] = view === null
    ? []
    : [view.rolling, view.weekly, view.monthly].filter((w): w is UsageWindow => w !== undefined)

  return (
    <div className={css.section} data-testid="ocgo-settings">
      <div>
        <h2 className={css.sectionTitle}>{t('ocgo.settingsTitle')}</h2>
        <p className={css.sectionIntro}>{t('ocgo.settingsIntro')}</p>
      </div>

      <div className={css.card}>
        <div className={css.cardTitle}>{t('ocgo.currentUsage')}</div>
        {view === null ? (
          <p className={css.hint}>{t('ocgo.error', { code: 'fetch' })}</p>
        ) : view.error !== undefined ? (
          <p className={css.noticeErr}>{view.message ?? t('ocgo.error', { code: view.error })}</p>
        ) : windows.length === 0 ? (
          <p className={css.hint}>{t('ocgo.unavailable')}</p>
        ) : (
          <div className={css.usageList}>
            {windows.map((w) => (
              <div key={w.kind} className={css.usageRow}>
                <span className={css.usageLabel}>
                  {w.status === 'rate-limited' ? t('ocgo.rateLimited') : t(WINDOW_TITLE_KEYS[w.kind])}
                </span>
                <span className={css.usageValue}>
                  <span className={severityClass(w)}>{w.percent}%</span>
                  <span className={css.usageReset}>
                    {t('ocgo.resetsIn', { duration: formatDuration(resetInSec(w)) })}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
        {view?.updatedAt !== undefined && (
          <p className={css.hint}>{t('ocgo.fetchedAt', { time: formatClock(view.updatedAt) })}</p>
        )}
      </div>

      <div className={css.card}>
        <div className={css.cardTitle}>{t('ocgo.visibility')}</div>
        <div className={css.options} role="radiogroup" aria-label={t('ocgo.visibility')}>
          {VISIBILITY_OPTIONS.map((mode) => {
            const active = config?.visibility === mode
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy || config === null}
                className={active ? `${css.option} ${css.optionActive}` : css.option}
                data-testid={`ocgo-visibility-${mode}`}
                onClick={() => { setVisibility(mode) }}
              >
                <span className={css.optionLabel}>{t(VISIBILITY_LABELS[mode])}</span>
                <span className={css.optionHint}>{t(VISIBILITY_HINTS[mode])}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Setup last: the credential is a one-off, while the two cards above are
          what a configured install actually comes here to read or change. */}
      <div className={css.card}>
        <div className={css.cardTitle}>{t('ocgo.credentials')}</div>

        <label className={css.row}>
          <span className={css.label}>{t('ocgo.apiKey')}</span>
          <input
            className={css.input}
            value={keyDraft}
            placeholder="sk-…"
            spellCheck={false}
            autoComplete="off"
            data-testid="ocgo-settings-key"
            onChange={(e) => { setNotice(null); setKeyDraft(e.target.value) }}
            onFocus={(e) => { if (e.target.value === maskedText(config?.apiKey)) e.target.select() }}
          />
        </label>

        <p className={css.hint}>
          {config?.source === undefined
            ? t('ocgo.keyMissing')
            : t('ocgo.keySource', { source: config.source })}
        </p>
        <p className={css.hint}>{t('ocgo.credentialsHint')}</p>

        <div className={css.actions}>
          <button type="button" className={css.primary} onClick={save} disabled={busy} data-testid="ocgo-settings-save">
            {busy ? t('ocgo.working') : t('ocgo.save')}
          </button>
          <button type="button" className={css.secondary} onClick={test} disabled={busy} data-testid="ocgo-settings-test">
            {t('ocgo.test')}
          </button>
          <button type="button" className={css.secondary} onClick={clear} disabled={busy} data-testid="ocgo-settings-clear">
            {t('ocgo.clear')}
          </button>
          {notice !== null && (
            <span
              className={notice.kind === 'ok' ? css.noticeOk : css.noticeErr}
              data-testid="ocgo-settings-notice"
            >
              {notice.text}
            </span>
          )}
        </div>

        <p className={css.warn}>{t('ocgo.securityNote')}</p>
      </div>
    </div>
  )
}
