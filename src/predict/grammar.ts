import { pick, type Rng } from '../lib/rng'

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
