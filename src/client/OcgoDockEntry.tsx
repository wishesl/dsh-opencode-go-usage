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

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MaskedConfigView, OcgoUsageView, UsageWindow } from '../types.ts'
import { NS } from './locales.ts'
import { maskedText, ocgoApi } from './host-api.ts'
import { formatClock, formatDuration, resetInSec, severityClass, WINDOW_LABELS, WINDOW_TITLE_KEYS } from './windows.ts'
import css from './ocgo.module.css'

/** Poll interval for the host usage snapshot. */
const POLL_MS = 10_000

// The window labels, the duration/clock formatters and the severity ramp now
// live in ./windows.ts so the settings page renders identical numbers.
// `formatDuration` stays re-exported below: this module's published surface is
// unchanged.
export { formatDuration } from './windows.ts'

/** Composed props of the dock entry (runtime + locale + the injected session face). */
export type OcgoDockEntryProps =
  PropsRuntime<'conversation.input.right'>
  & PropsLocale<typeof NS>
  & { dockSessionId?: string | undefined }

/** Detect dark mode via DSH body attribute. */
function useDarkMode(): boolean {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false
    return document.body.hasAttribute('data-ds-dark-theme')
  })
  useEffect(() => {
    const el = document.body
    if (!el) return
    const observer = new MutationObserver(() => {
      setDark(el.hasAttribute('data-ds-dark-theme'))
    })
    observer.observe(el, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    return () => observer.disconnect()
  }, [])
  return dark
}

/** The official OpenCode Go logo mark, inlined to avoid extra asset requests. */
function OcgoLogo(): React.ReactElement {
  const dark = useDarkMode()
  if (dark) {
    return (
      <svg className={css.logo} width="22" height="12" viewBox="0 0 54 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="100%" height="100%" fill="#2c2c2e" />
        <path d="M24 30H0V0H24V6H6V24H18V18H12V12H24V30Z" fill="#e6edf3" />
        <path d="M12 18H18V24H6V12H12V18Z" fill="#646464" />
        <path d="M48 12V24H36V12H48Z" fill="#646464" />
        <path d="M54 30H30V0H54V30ZM36 24H48V6H36V24Z" fill="#e6edf3" />
      </svg>
    )
  }
  return (
    <svg className={css.logo} width="22" height="12" viewBox="0 0 54 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M24 30H0V0H24V6H6V24H18V18H12V12H24V30Z" fill="#211E1E" />
      <path d="M12 18H18V24H6V12H12V18Z" fill="#CFCECD" />
      <path d="M48 12V24H36V12H48Z" fill="#CFCECD" />
      <path d="M54 30H30V0H54V30ZM36 24H48V6H36V24Z" fill="#211E1E" />
    </svg>
  )
}

/** Render one window segment: compact `· 5h 23%`, full `· 5h 23% (3h 25m)`. */
function WindowSegment(props: { window: UsageWindow; sep: string; compact?: boolean }): React.ReactElement {
  const { window, sep, compact = false } = props
  const cls = severityClass(window)
  return (
    <span className={css.seg}>
      <span className={css.segSep}>{sep}</span>
      <span className={cls ?? undefined}>
        {WINDOW_LABELS[window.kind]} {window.percent}%
        {!compact ? ` (${formatDuration(resetInSec(window))})` : ''}
      </span>
    </span>
  )
}

/**
 * The OpenCode Go usage chip: polls the host snapshot, renders the three
 * windows inline, and expands into a detail panel on click.
 * @param props - the composed dock entry props.
 */
export function OcgoDockEntry(props: OcgoDockEntryProps): React.ReactElement | null {
  const [view, setView] = useState<OcgoUsageView | null>(null)
  const [answered, setAnswered] = useState(false)
  const [open, setOpen] = useState(false)
  // Panel mode: 'view' = windows + footer; 'set' = API-key editor.
  const [mode, setMode] = useState<'view' | 'set'>('view')
  const [config, setConfig] = useState<MaskedConfigView | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const wrapRef = useRef<HTMLSpanElement>(null)
  const modeRef = useRef<'view' | 'set'>('view')
  modeRef.current = mode
  const draftsRef = useRef({ key: '' })
  draftsRef.current = { key: keyDraft }
  const configRef = useRef<MaskedConfigView | null>(null)
  configRef.current = config

  /** One periodic tick: read the host's usage snapshot. */
  const pollNow = useCallback(() => {
    let live = true
    ocgoApi.view().then((snapshot) => {
      if (!live) return
      setView(snapshot)
      setAnswered(true)
    }, () => {
      if (!live) return
      setView(null)
      setAnswered(true)
    })
    return () => { live = false }
  }, [])

  useEffect(() => {
    const cleanup = pollNow()
    const timer = window.setInterval(pollNow, POLL_MS)
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') pollNow()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cleanup()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [pollNow])

  /** Load the masked config into the editor drafts. */
  const loadConfig = useCallback(() => {
    ocgoApi.config().then((snapshot) => {
      setConfig(snapshot)
      setKeyDraft(maskedText(snapshot.apiKey))
    }, () => {
      // Editor still opens; the draft stays empty.
      setConfig(null)
      setKeyDraft('')
    })
  }, [])

  /** Submit any edited field; returns the write promise (fire-and-forget on blur). */
  const saveConfig = useCallback((): void => {
    const baseline = configRef.current
    const partial: { apiKey?: string } = {}
    const key = draftsRef.current.key.trim()
    if (key.length > 0 && key !== maskedText(baseline?.apiKey)) partial.apiKey = key
    if (Object.keys(partial).length === 0) return
    ocgoApi.writeConfig(partial).then((snapshot) => {
      setConfig(snapshot)
      setKeyDraft(maskedText(snapshot.apiKey))
      // The new key is live now (host invalidated its cache): poll now.
      pollNow()
    }, () => {
      // Ignore; the next poll resyncs and the editor keeps the draft.
    })
  }, [pollNow])

  /** Close the panel; in set mode a blur/close acts as confirm (save). */
  const closePanel = useCallback((): void => {
    if (modeRef.current === 'set') saveConfig()
    setOpen(false)
    setMode('view')
  }, [saveConfig])

  /** Open the editor (used by the Set button and the error chip). */
  const openSet = useCallback((): void => {
    setMode('set')
    setOpen(true)
    loadConfig()
  }, [loadConfig])

  // Close the detail panel when focus leaves the chip: any pointer press
  // outside the wrapper, or Escape. In set mode this CONFIRMS (saves).
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target !== null && wrapRef.current !== null && !wrapRef.current.contains(target)) {
        closePanel()
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closePanel()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, closePanel])

  const refresh = (): void => {
    ocgoApi.refresh().then((snapshot) => {
      setView(snapshot)
    }, () => {
      // Ignore transport errors on manual refresh; the next poll resyncs.
    })
  }

  const t = props.t
  const sep = ` ${t('ocgo.sep')} `

  // Nothing before the host's first answer, then the host's own verdict: it owns
  // the visibility mode and (in `provider` mode) the model-selection check, so
  // the browser never probes the provider itself.
  if (!answered) return null
  if (view !== null && view.showChip === false) return null

  const error = view === null ? { code: 'fetch' as const, message: t('ocgo.error', { code: 'fetch' }) }
    : view.error !== undefined
      ? { code: view.error, message: view.message ?? t('ocgo.error', { code: view.error }) }
      : null

  // Error state: the chip opens the Set editor directly so a rejected key can
  // be replaced in place; clicking outside (or Esc) confirms the write.
  if (error !== null) {
    return (
      <span className={css.wrap} ref={wrapRef} data-testid="ocgo-chip-error">
        <button
          type="button"
          className={open ? `${css.chip} ${css.chipOpen}` : css.chip}
          onClick={() => { if (open) closePanel(); else openSet() }}
          title={`${error.message}\n${t('ocgo.set')}`}
        >
          <OcgoLogo /> &lt;err:{error.code}&gt;
        </button>
        {open && (
          <span className={css.details}>
            <span className={css.setPanel}>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('ocgo.apiKey')}</span>
                <input
                  className={css.fieldInput}
                  value={keyDraft}
                  placeholder="sk-…"
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(e) => { setKeyDraft(e.target.value) }}
                  onFocus={(e) => { if (e.target.value === maskedText(config?.apiKey)) e.target.select() }}
                />
              </label>
              <span className={css.foot}>
                <span className={css.setHint}>{t('ocgo.setHint')}</span>
                <button type="button" className={css.refreshBtn} onClick={closePanel}>
                  {t('ocgo.save')}
                </button>
              </span>
            </span>
          </span>
        )}
      </span>
    )
  }

  // TS: after the error early-return, `view` is a non-null success snapshot.
  const snapshot = view as OcgoUsageView
  const windows: UsageWindow[] = [
    snapshot.rolling,
    snapshot.weekly,
    snapshot.monthly,
  ].filter((w): w is UsageWindow => w !== undefined)

  // No windows at all (e.g. brand-new account): show unavailable, refreshable.
  if (windows.length === 0) {
    return (
      <button
        type="button"
        className={css.chip}
        onClick={refresh}
        title={t('ocgo.refresh')}
        data-testid="ocgo-chip-empty"
      >
        <OcgoLogo /> {t('ocgo.unavailable')}
      </button>
    )
  }

  return (
    <span className={css.wrap} ref={wrapRef} data-testid="ocgo-chip">
      <button
        type="button"
        className={open ? `${css.chip} ${css.chipOpen}` : css.chip}
        onClick={() => { if (open) closePanel(); else setOpen(true) }}
        title={open ? t('ocgo.collapse') : t('ocgo.expand')}
      >
        <OcgoLogo />
        {windows.map((w) => (
          <WindowSegment key={w.kind} window={w} sep={sep} compact />
        ))}
        <span className={open ? `${css.chevron} ${css.chevronOpen}` : css.chevron} aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <span className={css.details}>
          {mode === 'set' ? (
            <span className={css.setPanel}>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('ocgo.apiKey')}</span>
                <input
                  className={css.fieldInput}
                  value={keyDraft}
                  placeholder="sk-…"
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(e) => { setKeyDraft(e.target.value) }}
                  onFocus={(e) => { if (e.target.value === maskedText(config?.apiKey)) e.target.select() }}
                />
              </label>
              <span className={css.foot}>
                <span className={css.setHint}>{t('ocgo.setHint')}</span>
                <button type="button" className={css.refreshBtn} onClick={closePanel}>
                  {t('ocgo.save')}
                </button>
              </span>
            </span>
          ) : (
            <>
              {windows.map((w) => (
                <span key={w.kind} className={css.window}>
                  <span className={css.windowLabel}>
                    {w.status === 'rate-limited' ? t('ocgo.rateLimited') : t(WINDOW_TITLE_KEYS[w.kind])}
                  </span>
                  <span className={css.windowValue}>
                    <span className={severityClass(w) ?? undefined}>{w.percent}%</span>
                    <span className={css.windowReset}>
                      {t('ocgo.resetsIn', { duration: formatDuration(resetInSec(w)) })}
                    </span>
                  </span>
                </span>
              ))}
              <span className={css.foot}>
                <button type="button" className={css.setBtn} onClick={openSet}>
                  {t('ocgo.set')}
                </button>
                <span className={css.footRight}>
                  <button type="button" className={css.refreshBtn} onClick={refresh}>
                    {t('ocgo.refresh')}
                  </button>
                  {snapshot.updatedAt !== undefined && (
                    <span className={css.fetchedAt}>
                      {t('ocgo.fetchedAt', { time: formatClock(snapshot.updatedAt) })}
                    </span>
                  )}
                </span>
              </span>
            </>
          )}
        </span>
      )}
    </span>
  )
}
