import type { Rng } from '../lib/rng'
import type { Tickbook } from './engine'

/** Where the sample book is centred, in ticks. */
export const START_MID = 100
/** The sample flow cancels more once this many orders rest, so the book stays readable. */
export const BUSY = 70

const int = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1))

/** A starting book: a few orders on every tick for `depth` ticks each side of the middle. Returns the ids placed. */
export function seedBook(tb: Tickbook, rng: Rng, depth = 8): number[] {
  const ids: number[] = []
  for (let d = 1; d <= depth; d++) {
    for (const side of ['buy', 'sell'] as const) {
      for (let k = int(rng, 1, 3); k > 0; k--) ids.push(tb.addLimit(side, side === 'buy' ? START_MID - d : START_MID + d, int(rng, 5, 40)).id)
    }
  }
  return ids
}

/**
 * One random order from the sample flow: mostly orders that rest near the top of the book, some
 * cancels, some that cross. `ids` is the flow's own resting orders and is updated in place.
 * This is made-up flow to give a visitor something to trade against, not market data.
 */
export function flowStep(tb: Tickbook, rng: Rng, ids: number[]): void {
  const bid = tb.levels('buy', 1)[0]?.price, ask = tb.levels('sell', 1)[0]?.price
  const side = rng() < 0.5 ? 'buy' : 'sell'
  const roll = rng()
  const rest = (): void => {
    // Priced from the far side's best, so it never crosses. An empty far side falls back to the middle.
    const away = 1 + Math.floor(rng() * rng() * 6)
    const price = side === 'buy' ? (ask ?? (bid ?? START_MID) + 2) - away : (bid ?? (ask ?? START_MID) - 2) + away
    const r = tb.addLimit(side, price, int(rng, 5, 40))
    if (r.resting > 0) ids.push(r.id)
  }
  const cancel = (): boolean => {
    while (ids.length) {
      const i = Math.floor(rng() * ids.length)
      const id = ids[i]
      ids[i] = ids[ids.length - 1]
      ids.pop()
      // An id that was filled since it rested is no longer in the book; try another.
      if (tb.cancel(id)) return true
    }
    return false
  }
  const busy = tb.orderCount() > BUSY
  if (roll < (busy ? 0.25 : 0.55)) rest()
  else if (roll < 0.8) { if (!cancel()) rest() }
  else if (roll < 0.92) {
    const far = side === 'buy' ? ask : bid
    if (far === undefined) rest()
    else {
      const r = tb.addLimit(side, side === 'buy' ? far + 1 : far - 1, int(rng, 3, 30))
      if (r.resting > 0) ids.push(r.id)
    }
  } else tb.addMarket(side, int(rng, 3, 25))
}

/** Orders placed before the clock starts in a timed run. */
export const PREFILL = 20_000

/**
 * A packed stream for timing, in the format Tickbook.run takes. The mix follows the native benchmark
 * in the Tickbook repo: 50% limit orders that rest 1 to 50 ticks from the middle, 4% limit orders that
 * cross by 1 to 3 ticks, 3% market orders, 43% cancels, quantities 1 to 100, after PREFILL resting
 * orders. It is the same recipe with a different random number generator, so not the same stream.
 * Cancels pick a resting order's id; some of those have been filled by then, and those cancels miss.
 */
export function timedStream(timed: number, rng: Rng): Int32Array {
  const MID = 100_000
  const total = PREFILL + timed
  const ops = new Int32Array(total * 4)
  const rested: number[] = []
  let nextId = 1 // the module numbers orders 1, 2, 3, ... in the order they arrive
  for (let n = 0; n < total; n++) {
    const o = n * 4
    const roll = n < PREFILL ? 0 : Math.floor(rng() * 100)
    const side = rng() < 0.5 ? 0 : 1
    if (roll >= 57 && rested.length) {
      const i = Math.floor(rng() * rested.length)
      ops[o] = 2
      ops[o + 2] = rested[i]
      rested[i] = rested[rested.length - 1]
      rested.pop()
      continue
    }
    const qty = int(rng, 1, 100)
    if (roll >= 54 && roll < 57) { ops[o] = 1; ops[o + 1] = side; ops[o + 3] = qty; nextId++; continue }
    const crossing = roll >= 50 && roll < 54
    const away = crossing ? -int(rng, 1, 3) : 1 + Math.floor((Math.floor(rng() * 50) * Math.floor(rng() * 50)) / 50)
    ops[o] = 0
    ops[o + 1] = side
    ops[o + 2] = side === 0 ? MID - away : MID + away
    ops[o + 3] = qty
    if (!crossing) rested.push(nextId)
    nextId++
  }
  return ops
}
