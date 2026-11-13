import { describe, expect, it } from 'vitest'
import { BONES, landmarks, lerpPose, shell } from '../src/hand/skeleton'
import { LETTERS, REST } from '../src/hand/poses'
import { project } from '../src/hand/draw'

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const TIP = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 }
const seg = (pts: number[][], a: number, b: number) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1], pts[a][2] - pts[b][2])

describe('hand', () => {
  it('defines every letter', () => {
    for (const ch of AZ) expect(LETTERS[ch], ch).toBeDefined()
  })
  it('produces 21 finite 3D points for every pose', () => {
    for (const pose of [REST, ...AZ.map((c) => LETTERS[c])]) {
      const pts = landmarks(pose)
      expect(pts).toHaveLength(21)
      for (const p of pts) { expect(p).toHaveLength(3); p.forEach((v) => expect(Number.isFinite(v)).toBe(true)) }
    }
  })
  it('keeps bone lengths constant across poses, as a real hand does', () => {
    const ref = landmarks(LETTERS.B)
    for (const ch of AZ) {
      const pts = landmarks(LETTERS[ch])
      for (const [a, b] of BONES) expect(seg(pts, a, b), `${ch} ${a}-${b}`).toBeCloseTo(seg(ref, a, b), 6)
    }
  })
  it('keeps every pose inside a sane box', () => {
    for (const ch of AZ) for (const [x, y, z] of landmarks(LETTERS[ch])) {
      expect(Math.abs(x)).toBeLessThan(2.2); expect(Math.abs(y - 0.6)).toBeLessThan(2.2); expect(Math.abs(z)).toBeLessThan(1.2)
    }
  })
  it('extends and curls the right fingers', () => {
    const a = landmarks(LETTERS.A), b = landmarks(LETTERS.B), l = landmarks(LETTERS.L), y = landmarks(LETTERS.Y)
    expect(b[TIP.index][1]).toBeGreaterThan(a[TIP.index][1] + 0.5)
    expect(l[TIP.index][1]).toBeGreaterThan(l[TIP.middle][1] + 0.5)
    expect(y[TIP.pinky][1]).toBeGreaterThan(y[TIP.ring][1] + 0.3)
  })
  it('curls fingers toward the viewer, never through the back of the hand', () => {
    for (const ch of AZ) for (const tip of [8, 12, 16, 20]) expect(landmarks(LETTERS[ch])[tip][2]).toBeGreaterThanOrEqual(-1e-9)
  })
  it('spreads V wider than U', () => {
    const gap = (ch: string) => { const p = landmarks(LETTERS[ch]); return Math.abs(p[TIP.middle][0] - p[TIP.index][0]) }
    expect(gap('V')).toBeGreaterThan(gap('U') + 0.1)
  })
  it('points G sideways', () => {
    expect(Math.abs(landmarks(LETTERS.G)[TIP.index][0])).toBeGreaterThan(0.8)
  })
  it('gives distinct shapes for look-alikes', () => {
    const dist = (a: string, b: string) => {
      const p = landmarks(LETTERS[a]), q = landmarks(LETTERS[b])
      return Math.max(...p.map((v, i) => Math.hypot(v[0] - q[i][0], v[1] - q[i][1], v[2] - q[i][2])))
    }
    for (const [a, b] of [['M', 'N'], ['U', 'V'], ['U', 'R'], ['A', 'S'], ['I', 'Y'], ['G', 'H'], ['K', 'P'], ['E', 'O'], ['D', 'X']])
      expect(dist(a, b), `${a}/${b}`).toBeGreaterThan(0.08)
  })
  it('mirrors left and right hands', () => {
    const r = landmarks(LETTERS.L), m = landmarks(LETTERS.L, true)
    r.forEach(([x, y, z], i) => { expect(m[i][0]).toBeCloseTo(-x, 9); expect(m[i][1]).toBeCloseTo(y, 9); expect(m[i][2]).toBeCloseTo(z, 9) })
  })
  it('blends poses', () => {
    expect(lerpPose(LETTERS.A, LETTERS.B, 0)).toEqual(LETTERS.A)
    expect(lerpPose(LETTERS.A, LETTERS.B, 1)).toEqual(LETTERS.B)
    expect(lerpPose(LETTERS.A, LETTERS.B, 0.5).fingers[0][0]).toBeCloseTo(44, 9)
  })
  it('connects all 21 points with 21 bones', () => {
    expect(BONES).toHaveLength(21)
    const used = new Set(BONES.flat())
    for (let i = 0; i < 21; i++) expect(used.has(i)).toBe(true)
  })
  it('has a palm outline and a forearm below the wrist', () => {
    const { palm, arm } = shell(LETTERS.B)
    expect(palm.length).toBeGreaterThanOrEqual(6)
    expect(arm).toHaveLength(4)
    expect(arm[1][0] - arm[0][0]).toBeGreaterThan(0.4)
    expect(arm[2][1]).toBeLessThan(-0.3)
  })
  it('projects nearer points larger', () => {
    const view = { cx: 0, cy: 0, scale: 100, yaw: 0, pitch: 0, pointer: null }
    const [far, near] = project([[1, 0.55, 0], [1, 0.55, 1]], view)
    expect(near[0]).toBeGreaterThan(far[0])
    expect(near[2]).toBeGreaterThan(far[2])
  })
})
