import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeLandmarks, parseForest, topK } from '../src/aslive/forest'
import fixture from './fixtures/aslive-vectors.json'
import { samples } from '../src/aslive/samples'

const file = readFileSync(new URL('../public/models/aslive-rf.bin', import.meta.url))
const forest = parseForest(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength))

describe('ASLive forest in the browser', () => {
  it('loads the full model', () => {
    expect(forest.trees).toBe(100)
    expect(forest.classes).toEqual(fixture.classes)
    expect(forest.classes).toHaveLength(27)
  })
  it('agrees with the original model on 150 real hands', () => {
    let same = 0, worst = 0
    for (const v of fixture.vectors) {
      const p = forest.predict(v.x)
      if (forest.classes[topK(p, 1)[0]] === v.label) same++
      v.proba.forEach((expected, i) => { worst = Math.max(worst, Math.abs(p[i] - expected)) })
    }
    expect(same).toBe(fixture.vectors.length)
    expect(worst).toBeLessThan(0.01)
  })
  it('returns probabilities that sum to 1', () => {
    const p = forest.predict(fixture.vectors[0].x)
    expect([...p].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4)
  })
  it('classifies every bundled sample as its own letter with the recorded confidence', () => {
    for (const [letter, list] of Object.entries(samples)) {
      expect(list).toHaveLength(4)
      for (const s of list) {
        const p = forest.predict(s.points)
        expect(forest.classes[topK(p, 1)[0]], letter).toBe(letter)
        expect(s.top[0][0]).toBe(letter)
        expect(p[forest.classes.indexOf(letter)]).toBeCloseTo(s.top[0][1], 1)
      }
    }
  })
  it('rejects a truncated file and wrong input size', () => {
    expect(() => parseForest(file.buffer.slice(file.byteOffset, file.byteOffset + 5000))).toThrow()
    expect(() => forest.predict([1, 2, 3])).toThrow()
  })
  it('normalizes landmarks the way the app does', () => {
    const pts = Array.from({ length: 21 }, (_, i) => ({ x: 0.5 + i * 0.01, y: 0.5 - i * 0.02, z: i * 0.001 }))
    const f = normalizeLandmarks(pts)
    expect(f).toHaveLength(63)
    expect(f.slice(0, 3)).toEqual([0, 0, 0])
    expect(Math.hypot(f[36], f[37], f[38])).toBeCloseTo(1, 9)
    const moved = normalizeLandmarks(pts.map((p) => ({ x: p.x * 2 + 0.1, y: p.y * 2 - 0.3, z: p.z * 2 })))
    moved.forEach((v, i) => expect(v).toBeCloseTo(f[i], 9))
  })
})

describe('chart display', () => {
  it('fits every sign to the same box size, however the model scales it', async () => {
    const { fitScale, toPoints } = await import('../src/aslive/draw')
    const box = { x: 0, y: 0, w: 100, h: 100 }
    for (const [sign, list] of Object.entries(samples)) for (const s of list) {
      const pts = toPoints(s.points)
      const k = fitScale(pts, box, 1)
      const xs = pts.map((p) => p[0] * k), ys = pts.map((p) => p[1] * k)
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys)
      expect(Math.max(w, h), sign).toBeCloseTo(100, 6)
      expect(Math.min(w, h), sign).toBeLessThanOrEqual(100 + 1e-6)
    }
  })
  it('rates a face-on hand as more legible than an edge-on one', async () => {
    const { legibility } = await import('../src/aslive/draw')
    expect(legibility([[0, 0], [1, 1]])).toBeGreaterThan(legibility([[0, 0], [0.1, 1]]))
  })
})
