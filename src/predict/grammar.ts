import { pick, shuffle, type Rng } from '../lib/rng'

export interface Frame { openers: string[]; middles: string[]; endings: string[] }

const size = (f: Frame): number => f.openers.length * f.middles.length * f.endings.length

export const countSentences = (frames: Frame[]): number => frames.reduce((n, f) => n + size(f), 0)

export function allSentences(frames: Frame[]): string[] {
  const out: string[] = []
  for (const f of frames)
    for (const o of f.openers) for (const m of f.middles) for (const e of f.endings) out.push(`${o} ${m} ${e}`)
  return out
}

/** Picks a frame in proportion to how many sentences it holds, so every sentence is equally likely. */
export function makeSentence(rng: Rng, frames: Frame[]): string {
  let roll = rng() * countSentences(frames)
  let frame = frames[frames.length - 1]
  for (const f of frames) {
    roll -= size(f)
    if (roll < 0) { frame = f; break }
  }
  return `${pick(rng, frame.openers)} ${pick(rng, frame.middles)} ${pick(rng, frame.endings)}`
}

/** How many recent endings a new sentence must avoid. */
const ENDING_MEMORY = 8

/**
 * Sentence source with memory: a shuffled deck of every sentence, dealt without replacement.
 * No sentence repeats until all have been shown. Where the deck allows, a sentence also avoids
 * the previous sentence's frame and any ending used in the last few sentences.
 */
export function createDeck(rng: Rng, frames: Frame[]): () => string {
  type Card = { text: string; frame: number; ending: string }
  const build = (): Card[] => {
    const cards: Card[] = []
    frames.forEach((f, frame) => {
      for (const o of f.openers) for (const m of f.middles) for (const ending of f.endings)
        cards.push({ text: `${o} ${m} ${ending}`, frame, ending })
    })
    return shuffle(rng, cards)
  }
  let deck = build()
  let lastFrame = -1
  const recent: string[] = []

  return () => {
    if (deck.length === 0) deck = build()
    let at = deck.findIndex((c) => c.frame !== lastFrame && !recent.includes(c.ending))
    if (at < 0) at = deck.findIndex((c) => c.frame !== lastFrame)
    if (at < 0) at = 0
    const [card] = deck.splice(at, 1)
    lastFrame = card.frame
    recent.push(card.ending)
    if (recent.length > ENDING_MEMORY) recent.shift()
    return card.text
  }
}
