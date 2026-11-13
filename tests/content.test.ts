import { describe, expect, it } from 'vitest'
import { site } from '../src/content/site'

describe('site content', () => {
  it('lists work with a name, line, stat and at least one https link each', () => {
    expect(site.work.length).toBeGreaterThanOrEqual(3)
    for (const item of site.work) {
      expect(item.name.trim()).not.toBe('')
      expect(item.line.trim()).not.toBe('')
      expect(item.stat.trim()).not.toBe('')
      expect(item.links.length).toBeGreaterThanOrEqual(1)
      for (const link of item.links) { expect(link.label.trim()).not.toBe(''); expect(link.url).toMatch(/^https:\/\//) }
    }
  })
  it('has profile links and no private contact details anywhere', () => {
    expect(site.links.map((l) => l.label)).toEqual(expect.arrayContaining(['GitHub', 'LinkedIn']))
    const everything = JSON.stringify(site)
    expect(everything).not.toMatch(/@gmail|mailto:|tel:|\+1 ?\(?\d{3}/)
  })
})
