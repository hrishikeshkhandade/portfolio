import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { how } from '../src/content/how'
import { site } from '../src/content/site'
import { renderHow } from '../src/how/render'
import { exact, listAll, ratioRule } from '../src/parity/count'

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
  it("states Chef's Fridge limits that match the deployed settings and the demo code", () => {
    const text = JSON.stringify(how.find((h) => h.id === 'chefs-fridge'))
    const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
    const perVisitor = config.match(/"DAILY_PER_VISITOR": "(\d+)"/)![1], total = config.match(/"DAILY_TOTAL": "(\d+)"/)![1]
    expect(text).toContain(`Each visitor gets ${perVisitor} tries a day and the whole site gets ${total}`)
    const scene = readFileSync(new URL('../src/scenes/chefs-fridge.ts', import.meta.url), 'utf8')
    const side = scene.match(/MAX_SIDE = (\d+)/)![1]
    expect(text).toContain(`at most ${side} pixels`)
    const worker = readFileSync(new URL('../worker/fridge.ts', import.meta.url), 'utf8')
    expect(worker).toContain('never as instructions')
    expect(worker).toContain('response_format')
  })
  it('states Parity Formula numbers that the code reproduces', () => {
    const text = JSON.stringify(how.find((h) => h.id === 'parity'))
    const first = { digits: [1, 2, 3, 4], length: 2, repeat: false }
    expect([exact(first).total, exact(first).even]).toEqual([12, 6])
    expect(ratioRule(first)).toEqual(exact(first))
    expect(text).toContain('12 arrangements')
    expect(text).toContain('6 even numbers')
    const zero = { digits: [0, 1, 2, 3, 4], length: 3, repeat: false }
    expect([ratioRule(zero).total, ratioRule(zero).even, exact(zero).total, exact(zero).even]).toEqual([60, 36, 48, 30])
    expect(text).toContain('60 numbers with 36 of them even. The truth is 48 and 30')
    // Ending in 0 versus ending in 2 or 4.
    const evens = listAll(zero, 99).evens
    expect([evens.filter((n) => n % 10 === 0).length, evens.filter((n) => n % 10 !== 0).length]).toEqual([12, 18])
    expect(text).toContain('12 ending in 0, plus 18 ending in 2 or 4, which makes 30')
    for (const value of site.work.find((w) => w.id === 'parity')!.stats!.map((x) => x.value).filter((v) => v !== '0')) expect(text).toContain(value)
  })
  it('states Tickbook numbers that match the module, the demo code and its scene', () => {
    const text = JSON.stringify(how.find((h) => h.id === 'tickbook'))
    const wasm = readFileSync(new URL('../public/wasm/tickbook.wasm', import.meta.url))
    expect(Math.round(wasm.length / 1000)).toBe(23)
    expect(text).toContain('about 23 KB')
    const exported = WebAssembly.Module.exports(new WebAssembly.Module(wasm)).filter((e) => e.name.startsWith('tb_'))
    expect(exported).toHaveLength(9)
    expect(text).toContain('nine plain functions')
    const scene = readFileSync(new URL('../src/scenes/tickbook.ts', import.meta.url), 'utf8')
    expect(scene).toMatch(/TIMED_OPS = 500_000\b/)
    expect(text).toContain('runs 500,000 operations')
    const flow = readFileSync(new URL('../src/tickbook/flow.ts', import.meta.url), 'utf8')
    expect(flow).toMatch(/PREFILL = 20_000\b/)
    expect(text).toContain('after 20,000 resting orders')
    const engine = readFileSync(new URL('../src/tickbook/engine.ts', import.meta.url), 'utf8')
    expect(engine).toMatch(/MAX_QTY = 1_000_000\b/)
    expect(engine).toMatch(/MAX_PRICE = 1_000_000\b/)
    expect(text).toContain('caps price and quantity at 1,000,000')
    // The scene's three numbers, as the write-up words them.
    const stats = site.work.find((w) => w.id === 'tickbook')!.stats!.map((x) => x.value)
    expect(stats).toEqual(['10–19M', '1.2M', '33'])
    expect(text).toContain('about 10 to 19 million a second')
    expect(text).toContain('1,200,000 operations')
    expect(text).toContain('There are 33 tests')
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
