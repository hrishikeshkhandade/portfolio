import { describe, expect, it } from 'vitest'
import { CONFUSION, barsAt, leaderAt, pickRivals, planLetter } from '../src/predict/timeline'
import { mulberry32 } from '../src/lib/rng'

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

describe('timeline', () => {
  it('has a confusion set for every letter that excludes itself', () => {
    for (const ch of AZ) {
      expect(CONFUSION[ch].length).toBeGreaterThanOrEqual(3)
      expect(CONFUSION[ch]).not.toContain(ch)
      expect(CONFUSION[ch]).toMatch(/^[A-Z]+$/)
    }
  })
  it('picks three distinct rivals, never the letter', () => {
    const r = mulberry32(1)
    for (const ch of AZ) for (let i = 0; i < 20; i++) {
      const rivals = pickRivals(r, ch)
      expect(rivals).toHaveLength(3)
      expect(new Set(rivals).size).toBe(3)
      expect(rivals).not.toContain(ch)
    }
  })
  it('plans probabilities that sum to 1 with a clear winner', () => {
    const r = mulberry32(2)
    for (let i = 0; i < 300; i++) {
      const p = planLetter(r, AZ[i % 26])
      expect(sum(p.probs)).toBeCloseTo(1, 6)
      expect(p.probs[0]).toBeGreaterThanOrEqual(0.82)
      expect(p.probs[0]).toBeLessThanOrEqual(0.97)
      expect(p.probs[1]).toBeGreaterThanOrEqual(p.probs[2])
      expect(p.probs[2]).toBeGreaterThanOrEqual(p.probs[3])
      expect(p.ms).toBeGreaterThanOrEqual(450)
    }
  })
  it('always ends on the correct letter with the planned values', () => {
    const r = mulberry32(3)
    for (let i = 0; i < 200; i++) {
      const p = planLetter(r, 'B')
      expect(leaderAt(p, 1)).toBe(0)
      barsAt(p, 1).forEach((v, k) => expect(v).toBeCloseTo(p.probs[k], 6))
    }
  })
  it('keeps bars normalized and in range throughout', () => {
    const r = mulberry32(4)
    for (let i = 0; i < 60; i++) {
      const p = planLetter(r, 'M')
      for (let t = 0; t <= 1; t += 0.05) {
        const bars = barsAt(p, t)
        expect(sum(bars)).toBeCloseTo(1, 6)
        bars.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) })
      }
    }
  })
  it('lets a rival lead mid-way when corrected', () => {
    const r = mulberry32(5)
    let seen = 0
    for (let i = 0; i < 400; i++) {
      const p = planLetter(r, 'S')
      if (p.behavior === 'corrected') { seen++; expect(leaderAt(p, 0.4)).toBe(1) }
      if (p.behavior === 'confident') expect(leaderAt(p, 0.4)).toBe(0)
    }
    expect(seen).toBeGreaterThan(10)
    expect(seen).toBeLessThan(80)
  })
  it('is deterministic per seed', () => {
    expect(planLetter(mulberry32(9), 'K')).toEqual(planLetter(mulberry32(9), 'K'))
  })
})
