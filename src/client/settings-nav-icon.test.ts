/**
 * Settings-nav glyph tests: the one decision (is this row mine?), the injected
 * stylesheet, and the install's whole lifecycle against a fake document — the
 * regression lock for claim / re-claim / hand-back, which no type can check.
 * @module @sutong12/dsh-opencode-go-usage/client/settings-nav-icon.test
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  NAV_ICON_MARKER,
  NAV_ICON_SIZE,
  NAV_ROW_SELECTOR,
  hasDirectGlyphSlot,
  installSettingsNavIcon,
  isOwnNavRow,
  navIconCss,
  type NavIconContext,
  type NavRow,
} from './settings-nav-icon.ts'

/** A nav row as the fake document serves it. */
class FakeRow implements NavRow {
  readonly attributes = new Set<string>()

  constructor(
    public textContent: string | null,
    readonly children: { tagName?: string }[] = [{ tagName: 'svg' }, { tagName: 'span' }],
  ) {}

  setAttribute(name: string): void {
    this.attributes.add(name)
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name)
  }

  /** Whether this row currently carries this plugin's marker. */
  get marked(): boolean {
    return this.attributes.has(NAV_ICON_MARKER)
  }
}

/** The `<style>` element the install owns. */
class FakeStyle {
  readonly dataset: Record<string, string> = {}
  textContent = ''
  removed = false

  remove(): void {
    this.removed = true
  }
}

/** The slice of the document the install touches. */
class FakeDocument {
  readonly styles: FakeStyle[] = []
  readonly head = {
    children: [] as unknown[],
    appendChild(node: unknown): unknown {
      this.children.push(node)
      return node
    },
  }

  readonly body = { tagName: 'BODY' }

  constructor(readonly rows: FakeRow[]) {}

  createElement(tagName: string): FakeStyle {
    void tagName
    const style = new FakeStyle()
    this.styles.push(style)
    return style
  }

  querySelectorAll(selector: string): FakeRow[] {
    if (selector === NAV_ROW_SELECTOR) return this.rows
    if (selector === `[${NAV_ICON_MARKER}]`) return this.rows.filter((row) => row.marked)
    throw new Error(`unexpected selector: ${selector}`)
  }
}

/** The observer the install constructs. */
class FakeObserver {
  static readonly instances: FakeObserver[] = []

  readonly observed: unknown[] = []
  disconnected = false

  constructor(private readonly callback: () => void) {
    FakeObserver.instances.push(this)
  }

  observe(target: unknown, options?: unknown): void {
    this.observed.push({ target, options })
  }

  disconnect(): void {
    this.disconnected = true
  }

  /** Simulate a DOM mutation reaching the observer. */
  fire(): void {
    this.callback()
  }

  static reset(): void {
    FakeObserver.instances.length = 0
  }
}

/** The globals the install reads, saved so every case restores the environment. */
interface InstallGlobals {
  document?: unknown
  MutationObserver?: unknown
}

const globals = globalThis as unknown as InstallGlobals
const saved: InstallGlobals = {}

/** Let a queued microtask (the coalesced sync) run. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Install against a fake document holding these rows.
 * @param rows - the rows the fake document reports.
 * @param resolveLabel - the label thunk the install resolves on every sync.
 * @returns the fake document, the constructed observer, and the disposer.
 */
function harness(rows: FakeRow[], resolveLabel: () => string): {
  fake: FakeDocument
  observer: FakeObserver
  dispose: () => void
} {
  const fake = new FakeDocument(rows)
  globals.document = fake
  globals.MutationObserver = FakeObserver
  let disposer: (() => void) | undefined
  const ctx: NavIconContext = {
    effect: (callback) => {
      disposer = callback() as () => void
    },
  }
  installSettingsNavIcon(ctx, resolveLabel)
  const observer = FakeObserver.instances.at(-1)
  if (observer === undefined) throw new Error('the install constructed no observer')
  return { fake, observer, dispose: () => { disposer?.() } }
}

beforeEach(() => {
  saved.document = globals.document
  saved.MutationObserver = globals.MutationObserver
  FakeObserver.reset()
})

afterEach(() => {
  if (saved.document === undefined) delete globals.document
  else globals.document = saved.document
  if (saved.MutationObserver === undefined) delete globals.MutationObserver
  else globals.MutationObserver = saved.MutationObserver
})

describe('isOwnNavRow', () => {
  it('matches the projected label exactly', () => {
    expect(isOwnNavRow('OpenCode Go', 'OpenCode Go')).toBe(true)
  })

  it('ignores surrounding whitespace on either side', () => {
    expect(isOwnNavRow('  OpenCode Go\n', ' OpenCode Go ')).toBe(true)
  })

  it('never claims a row for an empty or unresolved label', () => {
    expect(isOwnNavRow('OpenCode Go', '')).toBe(false)
    expect(isOwnNavRow('OpenCode Go', '   ')).toBe(false)
    expect(isOwnNavRow('OpenCode Go', undefined)).toBe(false)
    expect(isOwnNavRow('', '')).toBe(false)
    expect(isOwnNavRow('   ', '   ')).toBe(false)
  })

  it('is case-sensitive and rejects partial text', () => {
    expect(isOwnNavRow('opencode go', 'OpenCode Go')).toBe(false)
    expect(isOwnNavRow('OpenCode Go 用量', 'OpenCode Go')).toBe(false)
    expect(isOwnNavRow(null, 'OpenCode Go')).toBe(false)
  })
})

describe('hasDirectGlyphSlot', () => {
  it('accepts the shell row shape', () => {
    expect(hasDirectGlyphSlot(new FakeRow('x'))).toBe(true)
    expect(hasDirectGlyphSlot(new FakeRow('x', [{ tagName: 'SPAN' }, { tagName: 'svg' }]))).toBe(true)
  })

  it('rejects a text-only button', () => {
    expect(hasDirectGlyphSlot(new FakeRow('x', []))).toBe(false)
    expect(hasDirectGlyphSlot(new FakeRow('x', [{ tagName: 'span' }]))).toBe(false)
    expect(hasDirectGlyphSlot(undefined)).toBe(false)
  })
})

describe('navIconCss', () => {
  const css = navIconCss('data:image/svg+xml,mark')

  it('hides the shell glyph and draws the mark inside the row', () => {
    expect(css).toContain(`[${NAV_ICON_MARKER}] > svg { display: none; }`)
    expect(css).toContain(`[${NAV_ICON_MARKER}]::before {`)
    expect(css).toContain('background-color: currentColor;')
    expect(css).toContain('mask-image: url("data:image/svg+xml,mark");')
    expect(css).toContain('-webkit-mask-image: url("data:image/svg+xml,mark");')
  })

  it('uses the shell glyph geometry so the row cannot shift', () => {
    expect(NAV_ROW_SELECTOR).toBe('[role="dialog"] nav button')
    expect(NAV_ICON_SIZE).toBe(16)
    expect(css).toContain(`width: ${NAV_ICON_SIZE}px;`)
    expect(css).toContain(`height: ${NAV_ICON_SIZE}px;`)
    expect(css).toContain(`mask-size: ${NAV_ICON_SIZE}px ${NAV_ICON_SIZE}px;`)
  })
})

describe('installSettingsNavIcon', () => {
  it('claims its own row and leaves every other row alone', async () => {
    const mine = new FakeRow('OpenCode Go')
    const other = new FakeRow('通用')
    const { fake } = harness([other, mine, new FakeRow('模型')], () => 'OpenCode Go')
    await flush()
    expect(mine.marked).toBe(true)
    expect(other.marked).toBe(false)
    expect(fake.rows.filter((row) => row.marked)).toHaveLength(1)
  })

  it('injects exactly one owned stylesheet carrying the mask', async () => {
    const { fake } = harness([new FakeRow('OpenCode Go')], () => 'OpenCode Go')
    await flush()
    expect(fake.styles).toHaveLength(1)
    expect(fake.head.children).toHaveLength(1)
    const style = fake.styles[0]
    expect(style.dataset['plugin']).toBe('@sutong12/dsh-opencode-go-usage')
    expect(style.dataset['pluginCss']).toBe('@sutong12/dsh-opencode-go-usage/settings-nav-icon')
    expect(style.textContent).toContain('data:image/svg+xml,')
    expect(style.textContent).toContain(`[${NAV_ICON_MARKER}] > svg { display: none; }`)
  })

  it('does not claim a text match without the shell glyph slot', async () => {
    const textOnly = new FakeRow('OpenCode Go', [])
    harness([textOnly], () => 'OpenCode Go')
    await flush()
    expect(textOnly.marked).toBe(false)
  })

  it('claims nothing while the label is empty', async () => {
    const row = new FakeRow('OpenCode Go')
    harness([row], () => '')
    await flush()
    expect(row.marked).toBe(false)
  })

  it('follows the label when it changes', async () => {
    const oldRow = new FakeRow('OpenCode Go')
    const newRow = new FakeRow('用量')
    let label = 'OpenCode Go'
    const { observer } = harness([oldRow, newRow], () => label)
    await flush()
    expect(oldRow.marked).toBe(true)

    label = '用量'
    observer.fire()
    await flush()
    expect(oldRow.marked).toBe(false)
    expect(newRow.marked).toBe(true)
    expect([oldRow, newRow].filter((row) => row.marked)).toHaveLength(1)
  })

  it('re-claims after React replaces the row element', async () => {
    const first = new FakeRow('OpenCode Go')
    const { fake, observer } = harness([first], () => 'OpenCode Go')
    await flush()
    expect(first.marked).toBe(true)

    const second = new FakeRow('OpenCode Go')
    fake.rows.splice(0, 1, second)
    observer.fire()
    // Nothing is marked until the coalesced sync lands.
    expect(second.marked).toBe(false)
    await flush()
    expect(second.marked).toBe(true)
  })

  it('coalesces a burst of mutations into one sync', async () => {
    const mine = new FakeRow('OpenCode Go')
    const other = new FakeRow('通用')
    const { fake, observer } = harness([other], () => 'OpenCode Go')
    await flush()
    expect(fake.rows.filter((row) => row.marked)).toHaveLength(0)

    fake.rows.push(mine)
    observer.fire()
    observer.fire()
    observer.fire()
    await flush()
    expect(mine.marked).toBe(true)
  })

  it('hands the DOM back on dispose and ignores later mutations', async () => {
    const mine = new FakeRow('OpenCode Go')
    const { fake, observer, dispose } = harness([mine], () => 'OpenCode Go')
    await flush()
    expect(mine.marked).toBe(true)

    dispose()
    expect(mine.marked).toBe(false)
    expect(fake.styles[0].removed).toBe(true)
    expect(observer.disconnected).toBe(true)

    observer.fire()
    await flush()
    expect(mine.marked).toBe(false)
  })

  it('is a no-op without a document', () => {
    delete globals.document
    let effectRan = false
    installSettingsNavIcon({ effect: () => { effectRan = true } }, () => 'OpenCode Go')
    expect(effectRan).toBe(false)
    expect(FakeObserver.instances).toHaveLength(0)
  })
})
