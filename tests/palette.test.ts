import { describe, expect, it } from 'vitest'
import { paletteAt, contrast, css } from '../src/theme/palette'

describe('palette', () => {
  it('keeps contrast targets at every 10-minute step of the day', () => {
    for (let step = 0; step < 144; step++) {
      const p = paletteAt(step / 6)
      expect(contrast(p.ink, p.paper), `ink @${step / 6}`).toBeGreaterThanOrEqual(7)
      expect(contrast(p.soft, p.paper), `soft @${step / 6}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(p.signal, p.paper), `signal @${step / 6}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('is light by day and dark by night', () => {
    expect(paletteAt(13).dark).toBe(false)
    expect(paletteAt(23).dark).toBe(true)
    expect(paletteAt(3).dark).toBe(true)
  })
  it('stays in a warm hue family', () => {
    for (let h = 0; h < 24; h += 0.5) {
      const hue = paletteAt(h).paper.h
      expect(hue).toBeGreaterThanOrEqual(45); expect(hue).toBeLessThanOrEqual(95)
    }
  })
  it('changes smoothly within the day', () => {
    const a = paletteAt(14).paper, b = paletteAt(14 + 1 / 6).paper
    expect(Math.abs(a.l - b.l)).toBeLessThan(0.01)
  })
  it('wraps hours', () => {
    expect(paletteAt(25)).toEqual(paletteAt(1))
    expect(paletteAt(-1)).toEqual(paletteAt(23))
  })
  it('formats css', () => {
    expect(css({ l: 0.5, c: 0.1, h: 150 })).toBe('oklch(0.5 0.1 150)')
    expect(css({ l: 0.5, c: 0.1, h: 150 }, 0.2)).toBe('oklch(0.5 0.1 150 / 0.2)')
  })
})

describe('scene tints', () => {
  it('keep every contrast target through the whole day', () => {
    for (const tint of [{ h: 150, c: 0.032 }, { h: 285, c: 0.03 }, { h: 45, c: 0.05 }, { h: 20, c: 0.06 }, { h: 230, c: 0.04 }]) {
      for (let step = 0; step < 144; step++) {
        const p = paletteAt(step / 6, tint)
        expect(contrast(p.ink, p.paper), `ink h${tint.h} @${step / 6}`).toBeGreaterThanOrEqual(7)
        expect(contrast(p.soft, p.paper), `soft h${tint.h} @${step / 6}`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(p.signal, p.paper), `signal h${tint.h} @${step / 6}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
  it('change the paper color but not its lightness', () => {
    const plain = paletteAt(13), tinted = paletteAt(13, { h: 150, c: 0.032 })
    expect(tinted.paper.l).toBe(plain.paper.l)
    expect(tinted.paper.h).toBe(150)
    expect(tinted.paper).not.toEqual(plain.paper)
  })
})
