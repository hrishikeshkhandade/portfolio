import { describe, expect, it } from 'vitest'
import { BONES, landmarks, lerpPose } from '../src/hand/skeleton'
import { LETTERS, REST } from '../src/hand/poses'

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const TIP = { index: 8, middle: 12, ring: 16, pinky: 20 }

describe('hand', () => {
  it('defines every letter', () => {
    for (const ch of AZ) expect(LETTERS[ch], ch).toBeDefined()
  })
  it('produces 21 finite points for every pose', () => {
    for (const pose of [REST, ...AZ.map((c) => LETTERS[c])]) {
      const pts = landmarks(pose)
      expect(pts).toHaveLength(21)
      for (const [x, y] of pts) { expect(Number.isFinite(x)).toBe(true); expect(Number.isFinite(y)).toBe(true) }
      if (pose.rot === 0) expect(pts[0]).toEqual([0, 0])
    }
  })
  it('keeps every pose inside a sane box', () => {
    for (const ch of AZ) for (const [x, y] of landmarks(LETTERS[ch])) {
      expect(Math.abs(x)).toBeLessThan(2.2); expect(Math.abs(y - 0.6)).toBeLessThan(2.2)
    }
  })
  it('extends and curls the right fingers', () => {
    const a = landmarks(LETTERS.A), b = landmarks(LETTERS.B), l = landmarks(LETTERS.L), y = landmarks(LETTERS.Y)
    expect(b[TIP.index][1]).toBeGreaterThan(a[TIP.index][1] + 0.5)
    expect(l[TIP.index][1]).toBeGreaterThan(l[TIP.middle][1] + 0.5)
    expect(y[TIP.pinky][1]).toBeGreaterThan(y[TIP.ring][1] + 0.3)
  })
  it('spreads V wider than U', () => {
    const gap = (ch: string) => { const p = landmarks(LETTERS[ch]); return Math.abs(p[TIP.middle][0] - p[TIP.index][0]) }
    expect(gap('V')).toBeGreaterThan(gap('U') + 0.1)
  })
  it('points G sideways', () => {
    const g = landmarks(LETTERS.G)
    expect(Math.abs(g[TIP.index][0])).toBeGreaterThan(0.8)
  })
  it('gives distinct shapes for look-alikes that differ by one finger', () => {
    const dist = (a: string, b: string) => {
      const p = landmarks(LETTERS[a]), q = landmarks(LETTERS[b])
      return Math.max(...p.map(([x, y], i) => Math.hypot(x - q[i][0], y - q[i][1])))
    }
    for (const [a, b] of [['M', 'N'], ['U', 'V'], ['U', 'R'], ['A', 'S'], ['I', 'Y'], ['G', 'H'], ['K', 'P']])
      expect(dist(a, b), `${a}/${b}`).toBeGreaterThan(0.08)
  })
  it('mirrors left and right hands', () => {
    const r = landmarks(LETTERS.L), m = landmarks(LETTERS.L, true)
    r.forEach(([x, y], i) => { expect(m[i][0]).toBeCloseTo(-x, 9); expect(m[i][1]).toBeCloseTo(y, 9) })
  })
  it('blends poses', () => {
    expect(lerpPose(LETTERS.A, LETTERS.B, 0)).toEqual(LETTERS.A)
    expect(lerpPose(LETTERS.A, LETTERS.B, 1)).toEqual(LETTERS.B)
    expect(lerpPose(LETTERS.A, LETTERS.B, 0.5).curl[0]).toBeCloseTo(0.5, 9)
  })
  it('connects all 21 points with 21 bones', () => {
    expect(BONES).toHaveLength(21)
    const used = new Set(BONES.flat())
    for (let i = 0; i < 21; i++) expect(used.has(i)).toBe(true)
  })
})
