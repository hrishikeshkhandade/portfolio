import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { how } from '../src/content/how'
import { site } from '../src/content/site'
import { renderHow } from '../src/how/render'

const html = renderHow(site, how)

describe('how it works page', () => {
  it('every write-up belongs to a project and has a lede and well-formed sections', () => {
    expect(how.length).toBeGreaterThanOrEqual(1)
    expect(new Set(how.map((h) => h.id)).size).toBe(how.length)
    for (const entry of how) {
      expect(site.work.some((w) => w.id === entry.id), entry.id).toBe(true)
      expect(entry.lede.length, entry.id).toBeGreaterThan(60)
      expect(entry.sections.length, entry.id).toBeGreaterThanOrEqual(3)
      for (const s of entry.sections) {
        const kinds = [s.steps, s.points, s.list, s.text].filter((k) => k?.length)
        expect(kinds, `${entry.id}: ${s.title}`).toHaveLength(1)
      }
    }
  })
  it('renders every heading and line, with an anchor and a way back to the demo', () => {
    for (const entry of how) {
      expect(html).toContain(`<article id="${entry.id}">`)
      expect(html).toContain(`href="/#${entry.id}"`)
      for (const s of entry.sections) {
        expect(html).toContain(`<h3>${s.title}</h3>`)
        for (const item of [...(s.steps ?? []), ...(s.points ?? [])]) expect(html).toContain(`<h4>${item.head}</h4>`)
      }
    }
  })
  it('rejects a write-up for a project that does not exist', () => {
    expect(() => renderHow(site, [{ id: 'nope', lede: 'x', sections: [] }])).toThrow(/no project with id nope/)
  })
  it('escapes content and carries no contact details or em dashes', () => {
    const out = renderHow(site, [{ id: how[0].id, lede: '<img src=x onerror=alert(1)> & "q"', sections: [] }])
    expect(out).not.toContain('<img')
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+|mailto:|tel:/)
    expect(JSON.stringify(how)).not.toContain('—')
  })
  it('states the same Super Scholar numbers as its scene', () => {
    const text = JSON.stringify(how.find((h) => h.id === 'super-scholar'))
    const work = site.work.find((w) => w.id === 'super-scholar')!
    const stat = (label: RegExp) => work.stats!.find((s) => label.test(s.label))!
    const tests = stat(/automated tests/)
    expect(text).toContain(`${tests.value} automated tests`)
    expect(text).toContain(`${tests.label.match(/(\d+) play-throughs/)![1]} play-through checks`)
    expect(text).toContain(`${stat(/levels/).value} levels`)
    expect(text).toContain(`${stat(/papers built in/).value === '5' ? 'five' : '?'} built-in papers`)
  })
  it('states numbers about ASLive that match the model and the demo code', () => {
    const text = JSON.stringify(how.find((h) => h.id === 'aslive'))
    const scene = readFileSync(new URL('../src/scenes/aslive.ts', import.meta.url), 'utf8')
    expect(scene).toMatch(/HOLD_FRAMES = 12\b/)
    expect(scene).toMatch(/MIN_CONFIDENCE = 0\.5\b/)
    expect(text).toContain('12 frames in a row with at least 50% confidence')
    const model = readFileSync(new URL('../public/models/aslive-rf.bin', import.meta.url))
    const header = JSON.parse(model.subarray(4, 4 + model.readUInt32LE(0)).toString()) as { trees: number; features: number; classes: string[] }
    expect([header.trees, header.features, header.classes.length]).toEqual([100, 63, 27])
    expect(text).toContain('100 decision trees')
    expect(text).toContain('63 numbers')
    expect(text).toContain('27 signs')
    expect((model.length / 1e6).toFixed(1)).toBe('2.7')
    expect(text).toContain('2.7 MB')
  })
})
