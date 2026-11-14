import { describe, expect, it } from 'vitest'
import { mulberry32, pick, range, shuffle, randomSeed } from '../src/lib/rng'

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42), b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('differs between seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
  it('stays in [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
  it('range and pick stay in bounds', () => {
    const r = mulberry32(3)
    for (let i = 0; i < 200; i++) {
      const v = range(r, 2, 5); expect(v).toBeGreaterThanOrEqual(2); expect(v).toBeLessThan(5)
      expect(['a', 'b', 'c']).toContain(pick(r, ['a', 'b', 'c']))
    }
  })
  it('shuffle keeps all items and does not mutate input', () => {
    const src = [1, 2, 3, 4, 5]
    const out = shuffle(mulberry32(9), src)
    expect(src).toEqual([1, 2, 3, 4, 5])
    expect([...out].sort()).toEqual(src)
  })
  it('randomSeed is five digits', () => {
    const s = randomSeed(); expect(s).toBeGreaterThanOrEqual(10000); expect(s).toBeLessThanOrEqual(99999)
  })
})
