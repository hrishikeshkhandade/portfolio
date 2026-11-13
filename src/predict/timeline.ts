import { easeOut, lerp } from '../lib/ease'
import { range, shuffle, type Rng } from '../lib/rng'

/** Letters whose ASL handshapes are commonly mistaken for each other. */
export const CONFUSION: Record<string, string> = {
  A: 'ESTMN', B: 'FWU', C: 'OEX', D: 'ZXG', E: 'SAOM', F: 'BWD', G: 'HQZ', H: 'GUR', I: 'JYS',
  J: 'IYZ', K: 'VPR', L: 'GDY', M: 'NSTA', N: 'MTSA', O: 'CES', P: 'KQG', Q: 'GPH', R: 'UVH',
  S: 'ATEM', T: 'NMSA', U: 'RVH', V: 'UKW', W: 'VBF', X: 'DCZ', Y: 'IJL', Z: 'DXG',
}

export type Behavior = 'confident' | 'hesitant' | 'corrected'

export interface LetterPlan {
  letter: string
  rivals: [string, string, string]
  /** Final probabilities: [letter, rival 1, rival 2, rival 3], rivals in descending order. */
  probs: [number, number, number, number]
  behavior: Behavior
  ms: number
}

export function pickRivals(rng: Rng, letter: string): [string, string, string] {
  const [a, b, c] = shuffle(rng, CONFUSION[letter].split(''))
  return [a, b, c]
}

export function planLetter(rng: Rng, letter: string): LetterPlan {
  const rivals = pickRivals(rng, letter)
  const win = range(rng, 0.82, 0.97)
  const weights = [rng() + 0.2, rng() + 0.2, rng() + 0.2].sort((x, y) => y - x)
  const total = weights[0] + weights[1] + weights[2]
  const rest = 1 - win
  const roll = rng()
  const behavior: Behavior = roll < 1 / 12 ? 'corrected' : roll < 0.3 ? 'hesitant' : 'confident'
  const ms = range(rng, 260, 380) * (behavior === 'confident' ? 1 : behavior === 'hesitant' ? 1.5 : 2.1)
  return {
    letter,
    rivals,
    probs: [win, (rest * weights[0]) / total, (rest * weights[1]) / total, (rest * weights[2]) / total],
    behavior,
    ms,
  }
}

const UNIFORM = [0.25, 0.25, 0.25, 0.25]
const DETOUR: Record<Behavior, { at: number; via: number[] }> = {
  confident: { at: 0, via: UNIFORM },
  hesitant: { at: 0.4, via: [0.36, 0.4, 0.14, 0.1] },
  corrected: { at: 0.55, via: [0.18, 0.58, 0.14, 0.1] },
}

/** Displayed probabilities at progress t in [0, 1]. Index 0 is the correct letter. */
export function barsAt(plan: LetterPlan, t: number): number[] {
  const { at, via } = DETOUR[plan.behavior]
  if (at === 0) return plan.probs.map((p, i) => lerp(UNIFORM[i], p, easeOut(t)))
  if (t < at) return via.map((v, i) => lerp(UNIFORM[i], v, easeOut(t / at)))
  return plan.probs.map((p, i) => lerp(via[i], p, easeOut((t - at) / (1 - at))))
}

export function leaderAt(plan: LetterPlan, t: number): number {
  const bars = barsAt(plan, t)
  let best = 0
  for (let i = 1; i < bars.length; i++) if (bars[i] > bars[best]) best = i
  return best
}
