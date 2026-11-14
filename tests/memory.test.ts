import { describe, expect, it } from 'vitest'
import { createRememberedDeck, type Store } from '../src/predict/memory'
import { allSentences, countSentences } from '../src/predict/grammar'
import { site } from '../src/content/site'

const frames = site.landing.frames
const total = countSentences(frames)

function fakeStore(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v) } }
}
const seeds = (...list: number[]) => { let i = 0; return () => list[i++ % list.length] }

describe('remembered deck', () => {
  it('never shows the same sentence across separate visits until all are seen', () => {
    const store = fakeStore()
    const seen: string[] = []
    // 63 visits of 5 sentences each = the whole deck, reopened each time.
    for (let visit = 0; visit < total / 5; visit++) {
      const next = createRememberedDeck(frames, store, seeds(111))
      for (let i = 0; i < 5; i++) seen.push(next())
    }
    expect(seen).toHaveLength(total)
    expect(new Set(seen).size).toBe(total)
  })
  it('opens each visit with a line not seen before, even after a one-sentence visit', () => {
    const store = fakeStore()
    const openers = Array.from({ length: 100 }, () => createRememberedDeck(frames, store, seeds(7))())
    expect(new Set(openers).size).toBe(100)
  })
  it('starts a new shuffle once the whole deck has been seen', () => {
    const store = fakeStore()
    const next = createRememberedDeck(frames, store, seeds(1, 2))
    const first = Array.from({ length: total }, next)
    const second = Array.from({ length: total }, next)
    expect(new Set(second).size).toBe(total)
    expect(second).not.toEqual(first)
  })
  it('works without storage', () => {
    const next = createRememberedDeck(frames, null, seeds(5))
    const all = new Set(allSentences(frames))
    for (let i = 0; i < 20; i++) expect(all.has(next())).toBe(true)
  })
  it('ignores corrupt or outdated saved state', () => {
    const all = new Set(allSentences(frames))
    for (const bad of ['not json', '{"seed":1}', `{"seed":1,"pos":5,"size":${total + 1}}`, `{"seed":1,"pos":-3,"size":${total}}`]) {
      const store = fakeStore()
      store.data.set('landing-deck', bad)
      expect(all.has(createRememberedDeck(frames, store, seeds(9))())).toBe(true)
    }
  })
  it('survives storage that throws', () => {
    const store: Store = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
    expect(typeof createRememberedDeck(frames, store, seeds(4))()).toBe('string')
  })
})
