import { describe, expect, it } from 'vitest'
import { allSentences, countSentences, makeSentence } from '../src/predict/grammar'
import { mulberry32 } from '../src/lib/rng'
import { site } from '../src/content/site'

const frames = site.landing.frames

describe('grammar', () => {
  it('offers at least 300 sentences', () => {
    expect(countSentences(frames)).toBeGreaterThanOrEqual(300)
    expect(allSentences(frames)).toHaveLength(countSentences(frames))
  })
  it('has no duplicates', () => {
    const all = allSentences(frames)
    expect(new Set(all).size).toBe(all.length)
  })
  it('uses only supported characters and sane lengths', () => {
    for (const s of allSentences(frames)) {
      expect(s).toMatch(/^[A-Za-z0-9 ,.'-]+$/)
      expect(s.length).toBeLessThanOrEqual(64)
      expect(s).not.toMatch(/\s{2,}/)
    }
  })
  it('is deterministic per seed and always a known sentence', () => {
    const all = new Set(allSentences(frames))
    const a = mulberry32(5), b = mulberry32(5)
    for (let i = 0; i < 50; i++) {
      const s = makeSentence(a, frames)
      expect(s).toBe(makeSentence(b, frames))
      expect(all.has(s)).toBe(true)
    }
  })
  it('reaches every frame', () => {
    const r = mulberry32(11)
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) seen.add(makeSentence(r, frames).split(' ')[0])
    for (const f of frames) expect(f.openers.some((o) => seen.has(o.split(' ')[0]))).toBe(true)
  })
})

describe('deck', () => {
  const frameOf = (s: string) => frames.findIndex((f) => f.openers.some((o) => s.startsWith(o + ' ')))
  const endingOf = (s: string) => frames.flatMap((f) => f.endings).find((e) => s.endsWith(' ' + e))!
  const total = countSentences(frames)

  it('shows every sentence once before any repeats, for many seeds', async () => {
    const { createDeck } = await import('../src/predict/grammar')
    for (let seed = 1; seed <= 40; seed++) {
      const next = createDeck(mulberry32(seed), frames)
      const drawn = Array.from({ length: total }, next)
      expect(new Set(drawn).size, `seed ${seed}`).toBe(total)
    }
  })
  it('avoids the previous frame and the last 8 endings through the first 150 sentences', async () => {
    const { createDeck } = await import('../src/predict/grammar')
    for (let seed = 1; seed <= 40; seed++) {
      const next = createDeck(mulberry32(seed), frames)
      const drawn = Array.from({ length: 150 }, next)
      for (let i = 1; i < drawn.length; i++) {
        expect(frameOf(drawn[i]), `seed ${seed} #${i}`).not.toBe(frameOf(drawn[i - 1]))
        const window = drawn.slice(Math.max(0, i - 8), i).map(endingOf)
        expect(window, `seed ${seed} #${i}`).not.toContain(endingOf(drawn[i]))
      }
    }
  })
  it('keeps producing valid sentences after the deck runs out', async () => {
    const { createDeck } = await import('../src/predict/grammar')
    const all = new Set(allSentences(frames))
    const next = createDeck(mulberry32(8), frames)
    for (let i = 0; i < total * 2 + 10; i++) expect(all.has(next())).toBe(true)
  })
})
