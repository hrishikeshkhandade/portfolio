import { mulberry32, randomSeed } from '../lib/rng'
import { countSentences, createDeck, type Frame } from './grammar'

/** The part of localStorage this module needs; lets tests pass a fake. */
export interface Store {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const KEY = 'landing-deck'

interface Saved { seed: number; pos: number; size: number }

function load(store: Store | null, size: number): Saved | null {
  try {
    const raw = store?.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<Saved>
    if (!Number.isInteger(v.seed) || !Number.isInteger(v.pos) || v.size !== size) return null
    if (v.pos! < 0 || v.pos! >= size) return null
    return v as Saved
  } catch {
    return null
  }
}

function save(store: Store | null, state: Saved): void {
  try {
    store?.setItem(KEY, JSON.stringify(state))
  } catch { /* storage full or blocked: carry on without memory */ }
}

/**
 * Sentence source that remembers, on this device, how far through the deck the visitor has got.
 * Closing and reopening the site continues where it left off, so a visitor sees every sentence
 * once before any repeats. If the sentence list changes or storage is unavailable, it starts a
 * fresh deck.
 */
export function createRememberedDeck(frames: Frame[], store: Store | null, newSeed: () => number = randomSeed): () => string {
  const size = countSentences(frames)
  let state = load(store, size) ?? { seed: newSeed(), pos: 0, size }
  let next = createDeck(mulberry32(state.seed), frames)
  for (let i = 0; i < state.pos; i++) next()

  return () => {
    if (state.pos >= size) {
      state = { seed: newSeed(), pos: 0, size }
      next = createDeck(mulberry32(state.seed), frames)
    }
    const text = next()
    state = { ...state, pos: state.pos + 1 }
    save(store, state)
    return text
  }
}

/** localStorage if the browser allows it, otherwise null. */
export function browserStore(): Store | null {
  try {
    const s = window.localStorage
    s.getItem(KEY)
    return s
  } catch {
    return null
  }
}
