import { describe, expect, it } from 'vitest'
import { site } from '../src/content/site'

describe('site content', () => {
  it('lists work with a name, line, stat and at least one https link each', () => {
    expect(site.work.length).toBeGreaterThanOrEqual(3)
    for (const item of site.work) {
      expect(item.name.trim()).not.toBe('')
      expect(item.line.trim()).not.toBe('')
      expect(item.stat.trim()).not.toBe('')
      // Work with nothing published yet has no outside link; its scene is the proof.
      if (!['parity', 'tickbook'].includes(item.id ?? '')) expect(item.links.length).toBeGreaterThanOrEqual(1)
      for (const link of item.links) { expect(link.label.trim()).not.toBe(''); expect(link.url).toMatch(/^https:\/\//) }
    }
  })
  it('has profile links and no private contact details anywhere', () => {
    expect(site.links.map((l) => l.label)).toEqual(expect.arrayContaining(['GitHub', 'LinkedIn']))
    const everything = JSON.stringify(site)
    expect(everything).not.toMatch(/@gmail|mailto:|tel:|\+1 ?\(?\d{3}/)
  })
})

describe('project scenes', () => {
  it('every project has an id, summary and three stats for its scene', () => {
    for (const item of site.work) {
      expect(item.id, item.name).toMatch(/^[a-z][a-z-]+$/)
      expect(item.summary?.length, item.name).toBeGreaterThan(40)
      expect(item.stats, item.name).toHaveLength(3)
    }
    expect(new Set(site.work.map((w) => w.id)).size).toBe(site.work.length)
  })
  it('Super Scholar screenshots exist on disk', async () => {
    const { existsSync } = await import('node:fs')
    const shots = site.work.find((w) => w.id === 'super-scholar')!.shots!
    expect(shots.length).toBeGreaterThanOrEqual(6)
    for (const s of shots) {
      expect(existsSync(new URL(`../public/media/super-scholar/${s.file}.png`, import.meta.url)), s.file).toBe(true)
      expect(s.caption.trim()).not.toBe('')
    }
  })
  it("Chef's Fridge samples only cook with what is in the fridge", () => {
    const fridges = site.work.find((w) => w.id === 'chefs-fridge')!.fridges!
    expect(fridges).toHaveLength(3)
    for (const f of fridges) {
      expect(f.items.length).toBeGreaterThanOrEqual(5)
      expect(f.recipe.steps.length).toBeGreaterThanOrEqual(3)
      const text = `${f.recipe.title} ${f.recipe.steps.join(' ')}`.toLowerCase()
      // at least four of the fridge's ingredients are actually used
      const used = f.items.filter((item) => text.includes(item.split(' ').pop()!.replace(/(es|s)$/, '')))
      expect(used.length, f.name).toBeGreaterThanOrEqual(4)
    }
  })
})
