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

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MaskedConfigView, OcgoUsageView, UsageWindow } from '../types.ts'
import { chipVisible } from '../provider.ts'
import { onConfigChanged } from './config-bus.ts'
import { NS } from './locales.ts'
import { OCGO_MARK_DARK_BG, OCGO_MARK_INK, OCGO_MARK_PATHS, OCGO_MARK_VIEW_BOX } from './ocgo-mark.ts'
import { maskedText, ocgoApi } from './host-api.ts'
import type { ProviderProbe } from './model-provider.ts'
import { formatClock, formatDuration, resetInSec, severityClass, WINDOW_LABELS, WINDOW_TITLE_KEYS } from './windows.ts'
import css from './ocgo.module.css'

/** Poll interval for the host usage snapshot. The provider gate does not wait
 * for it: the model-selection store notifies this component directly. */
const POLL_MS = 10_000

/** A disposer that does nothing, for a probe that could not subscribe. */
const NOOP = (): void => {}

// The window labels, the duration/clock formatters and the severity ramp now
// live in ./windows.ts so the settings page renders identical numbers.
// `formatDuration` stays re-exported below: this module's published surface is
// unchanged.
export { formatDuration } from './windows.ts'

/** Composed props of the dock entry (runtime + locale + the injected session face). */
export type OcgoDockEntryProps =
  PropsRuntime<'conversation.input.right'>
  & PropsLocale<typeof NS>
  & {
    /** The session this entry renders for. */
    dockSessionId?: string | undefined
    /** Live model-selection probe; absent leaves `provider` visibility open. */
    provider?: ProviderProbe
  }

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

/**
 * The official OpenCode Go logo mark, inlined to avoid extra asset requests.
 * The art itself lives in ./ocgo-mark.ts so the settings navigation row can
 * draw the very same mark as its glyph.
 */
function OcgoLogo(): React.ReactElement {
  const dark = useDarkMode()
  const ink = dark ? OCGO_MARK_INK.dark : OCGO_MARK_INK.light
  return (
    <svg className={css.logo} width="22" height="12" viewBox={OCGO_MARK_VIEW_BOX} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {dark && <rect width="100%" height="100%" fill={OCGO_MARK_DARK_BG} />}
      {OCGO_MARK_PATHS.map((path) => <path key={path.d} d={path.d} fill={ink[path.tone]} />)}
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
  // The last poll could not reach the host (timeout / transport failure): the
  // previous round stays on screen, flagged, instead of blanking into an error.
  const [unreachable, setUnreachable] = useState(false)
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

  // The provider gate reads the very store the model selector renders from:
  // synchronous, in-memory, and notified on every selection change — so picking
  // a model lands here at once instead of on the next poll.
  const probe = props.provider
  const subscribeProvider = useCallback(
    (onChange: () => void) => (probe === undefined ? NOOP : probe.subscribe(onChange)),
    [probe],
  )
  const readProvider = useCallback(() => probe?.read(), [probe])
  const provider = useSyncExternalStore(subscribeProvider, readProvider)

  /** One periodic tick: read the host's usage snapshot. */
  const pollNow = useCallback(() => {
    let live = true
    ocgoApi.view().then((snapshot) => {
      if (!live) return
      setView(snapshot)
      setUnreachable(false)
      setAnswered(true)
    }, () => {
      if (!live) return
      // One unreachable access is not a reason to throw away the last round:
      // keep whatever is on screen and flag it as stale. Only a poll that has
      // never succeeded falls through to the error chip below.
      setUnreachable(true)
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

  // A config write made in this bundle (Settings → OpenCode Go) reaches the chip
  // at once instead of on the next tick. The provider gate needs no such signal:
  // the model-selection store pushes to it directly.
  useEffect(() => onConfigChanged(pollNow), [pollNow])

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
      setUnreachable(false)
    }, () => {
      // Keep the previous round on screen instead of erroring out; the next
      // poll resyncs once the host answers again.
      setUnreachable(true)
    })
  }

  const t = props.t
  const sep = ` ${t('ocgo.sep')} `

  // Nothing before the host's first answer. Then the mode the host reports is
  // applied to the live provider read above, and the two states that have
  // nothing to say in the composer are dropped outright.
  if (!answered) return null
  if (view !== null && (view.error === 'noconfig' || view.error === 'disabled')) return null
  if (!chipVisible(view?.visibility ?? 'always', provider)) return null

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
  // Stale when the host already flagged its read as a surviving round, or when
  // this browser could not reach it and is showing what the last round produced.
  const stale = unreachable || snapshot.stale === true
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
    <span className={css.wrap} ref={wrapRef} data-testid="ocgo-chip" data-stale={stale || undefined}>
      <button
        type="button"
        className={open ? `${css.chip} ${css.chipOpen}` : css.chip}
        onClick={() => { if (open) closePanel(); else setOpen(true) }}
        title={stale ? t('ocgo.stale') : (open ? t('ocgo.collapse') : t('ocgo.expand'))}
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
                    <span
                      className={stale ? `${css.fetchedAt} ${css.fetchedStale}` : css.fetchedAt}
                      title={stale ? t('ocgo.stale') : undefined}
                    >
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
