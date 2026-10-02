/**
 * The shared mark: one path set feeds the composer chip's two-tone glyph and
 * the settings nav row's single-colour mask, and the mask URL has to survive
 * being pasted into a stylesheet.
 * @module @sutong12/dsh-opencode-go-usage/client/ocgo-mark.test
 */

import { describe, expect, it } from 'vitest'
import {
  OCGO_MARK_BOX,
  OCGO_MARK_DARK_BG,
  OCGO_MARK_INK,
  OCGO_MARK_OFFSET_Y,
  OCGO_MARK_PATHS,
  OCGO_MARK_VIEW_BOX,
  ocgoMaskSvg,
  ocgoMaskUrl,
} from './ocgo-mark.ts'

/** Every hex colour literal in a string. */
function colours(source: string): string[] {
  return source.match(/#[0-9a-fA-F]{3,6}/g) ?? []
}

describe('OCGO_MARK_PATHS', () => {
  it('keeps the official draw order and tones', () => {
    expect(OCGO_MARK_PATHS.map((path) => path.tone)).toEqual(['ink', 'accent', 'accent', 'ink'])
    expect(new Set(OCGO_MARK_PATHS.map((path) => path.d)).size).toBe(OCGO_MARK_PATHS.length)
  })

  it('defines a colour for every tone in both themes', () => {
    for (const theme of [OCGO_MARK_INK.light, OCGO_MARK_INK.dark]) {
      for (const path of OCGO_MARK_PATHS) {
        expect(theme[path.tone]).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    }
    expect(OCGO_MARK_DARK_BG).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})

describe('ocgoMaskSvg', () => {
  it('centres the art in the square glyph box', () => {
    const svg = ocgoMaskSvg()
    expect(OCGO_MARK_VIEW_BOX).toBe('0 0 54 30')
    expect(svg).toContain(`viewBox="0 0 ${OCGO_MARK_BOX} ${OCGO_MARK_BOX}"`)
    expect(svg).toContain(`transform="translate(0 ${OCGO_MARK_OFFSET_Y})"`)
    expect(OCGO_MARK_OFFSET_Y).toBe((OCGO_MARK_BOX - 30) / 2)
  })

  it('draws only the ink paths', () => {
    const svg = ocgoMaskSvg()
    for (const path of OCGO_MARK_PATHS) {
      if (path.tone === 'ink') expect(svg).toContain(`<path d="${path.d}" fill="#000"/>`)
      else expect(svg).not.toContain(path.d)
    }
  })

  it('paints black only — a mask carries no colour of its own', () => {
    const found = colours(ocgoMaskSvg())
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((colour) => colour === '#000')).toBe(true)
  })
})

describe('ocgoMaskUrl', () => {
  it('percent-encodes the source', () => {
    const url = ocgoMaskUrl()
    const prefix = 'data:image/svg+xml,'
    expect(url.startsWith(prefix)).toBe(true)
    const payload = url.slice(prefix.length)
    expect(payload).not.toMatch(/[#"]/)
    expect(decodeURIComponent(payload)).toBe(ocgoMaskSvg())
  })

  it('accepts an explicit source', () => {
    expect(ocgoMaskUrl('<svg/>')).toBe('data:image/svg+xml,%3Csvg%2F%3E')
  })
})
