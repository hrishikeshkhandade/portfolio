import { describe, expect, it } from 'vitest'
import { cleanDigits, exact, explainEven, listAll, perm, ratioRule, type Query } from '../src/parity/count'
import { site } from '../src/content/site'

const MAX_LENGTH = 5
/** Every non-empty set of digits 0 to 9. */
const allSets = (): number[][] => {
  const sets: number[][] = []
  for (let mask = 1; mask < 1 << 10; mask++) sets.push([...Array(10).keys()].filter((d) => mask & (1 << d)))
  return sets
}

describe('parity counting', () => {
  it('reproduces the two worked examples from the original paper', () => {
    expect(exact({ digits: [1, 2, 3, 4], length: 2, repeat: false })).toEqual({ total: 12, even: 6, odd: 6 })
    expect(exact({ digits: [1, 3, 5], length: 3, repeat: true })).toEqual({ total: 27, even: 0, odd: 27 })
  })

  it('handles zero, which cannot lead', () => {
    // 10, 12, 20, 21 from {0, 1, 2}
    expect(exact({ digits: [0, 1, 2], length: 2, repeat: false })).toEqual({ total: 4, even: 3, odd: 1 })
    expect(listAll({ digits: [0, 1, 2], length: 2, repeat: false }, 9).evens).toEqual([10, 12, 20])
    expect(exact({ digits: [0], length: 1, repeat: false })).toEqual({ total: 1, even: 1, odd: 0 })
    expect(exact({ digits: [0], length: 3, repeat: true })).toEqual({ total: 0, even: 0, odd: 0 })
  })

  it('returns nothing for impossible questions', () => {
    expect(exact({ digits: [], length: 2, repeat: true }).total).toBe(0)
    expect(exact({ digits: [1, 2], length: 3, repeat: false }).total).toBe(0)
    expect(perm(3, 4)).toBe(0)
    expect(cleanDigits([3, 3, 1, 12, -1, 0.5])).toEqual([1, 3])
  })

  it('matches listing every number, for every digit set, and the stat on the site says how many', () => {
    let cases = 0, ratioWrong = 0
    for (const digits of allSets()) {
      for (let length = 1; length <= MAX_LENGTH; length++) {
        for (const repeat of [false, true]) {
          const q: Query = { digits, length, repeat }
          const { total, even, odd } = listAll(q)
          expect(exact(q), JSON.stringify(q)).toEqual({ total, even, odd })
          const simple = ratioRule(q)
          const zeroMatters = digits[0] === 0 && length > 1 && simple.total > 0
          // The first version of the formula is exact whenever zero is not in play, and never when it is.
          if (zeroMatters) { expect(simple.total, JSON.stringify(q)).not.toBe(total); ratioWrong++ }
          else expect(simple, JSON.stringify(q)).toEqual({ total, even, odd })
          cases++
        }
      }
    }
    expect(cases).toBe(10230)
    expect(ratioWrong).toBeGreaterThan(0)
    const stats = site.work.find((w) => w.id === 'parity')!.stats!.map((s) => s.value)
    expect(stats).toContain('1,023')
    expect(stats).toContain(cases.toLocaleString('en-US'))
  })

  it('explains its working with the same number it returns', () => {
    for (const q of [
      { digits: [0, 1, 2, 3, 4], length: 3, repeat: false },
      { digits: [1, 2, 3, 4], length: 2, repeat: false },
      { digits: [0, 2, 5, 8], length: 4, repeat: true },
    ]) {
      const last = explainEven(q).at(-1)!
      expect(last, JSON.stringify(q)).toContain(`${exact(q).even.toLocaleString('en-US')} even numbers`)
    }
    expect(explainEven({ digits: [1, 3], length: 2, repeat: true })[0]).toMatch(/no number is even/i)
  })
})
