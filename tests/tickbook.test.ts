import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { mulberry32 } from '../src/lib/rng'
import { compileTickbook, type Tickbook } from '../src/tickbook/engine'
import { flowStep, PREFILL, seedBook, START_MID, timedStream } from '../src/tickbook/flow'

// These run the real WebAssembly module that the site serves, not a stand-in.
let make: () => Tickbook
beforeAll(async () => { make = await compileTickbook(readFileSync(new URL('../public/wasm/tickbook.wasm', import.meta.url))) })

describe('tickbook engine in WebAssembly', () => {
  it('matches by price, then time, at the resting price', () => {
    const tb = make()
    const a = tb.addLimit('sell', 101, 5), b = tb.addLimit('sell', 101, 7), c = tb.addLimit('sell', 100, 2)
    expect([a.id, b.id, c.id]).toEqual([1, 2, 3])
    const r = tb.addLimit('buy', 105, 10)
    expect(r).toEqual({ id: 4, reject: 'none', filled: 10, resting: 0, cancelled: 0 })
    expect(tb.takeTrades()).toEqual([
      { seq: 0, makerId: 3, takerId: 4, takerSide: 'buy', price: 100, qty: 2 },
      { seq: 1, makerId: 1, takerId: 4, takerSide: 'buy', price: 101, qty: 5 },
      { seq: 2, makerId: 2, takerId: 4, takerSide: 'buy', price: 101, qty: 3 },
    ])
    expect(tb.takeTrades()).toEqual([])
    expect(tb.levels('sell', 5)).toEqual([{ price: 101, qty: 4, orders: 1 }])
    expect(tb.resting('sell')).toEqual([{ id: 2, price: 101, qty: 4 }])
  })
  it('handles each order type and cancel', () => {
    const tb = make()
    tb.addLimit('sell', 101, 4)
    expect(tb.addLimit('buy', 101, 9, 'FOK')).toMatchObject({ reject: 'fok-not-fillable', filled: 0, resting: 0 })
    expect(tb.addLimit('buy', 101, 6, 'IOC')).toMatchObject({ reject: 'none', filled: 4, resting: 0, cancelled: 2 })
    expect(tb.addMarket('sell', 3)).toMatchObject({ filled: 0, cancelled: 3 })
    expect(tb.addLimit('buy', 99, 0)).toMatchObject({ reject: 'zero-qty' })
    const rest = tb.addLimit('buy', -7, 2)
    expect(tb.levels('buy', 5)).toEqual([{ price: -7, qty: 2, orders: 1 }])
    expect(tb.cancel(rest.id)).toBe(true)
    expect(tb.cancel(rest.id)).toBe(false)
    expect(tb.orderCount()).toBe(0)
  })
  it('gives every instance its own book, and refuses numbers that are not whole', () => {
    const one = make(), two = make()
    one.addLimit('buy', 10, 1)
    expect([one.orderCount(), two.orderCount()]).toEqual([1, 0])
    one.reset()
    expect(one.orderCount()).toBe(0)
    expect(() => one.addLimit('buy', 1.5, 1)).toThrow(RangeError)
    expect(() => one.addLimit('buy', 1, -1)).toThrow(RangeError)
  })
})

describe('sample flow and timed stream', () => {
  it('seeds a two-sided book around the middle and keeps it uncrossed under random flow', () => {
    const tb = make(), rng = mulberry32(7)
    const ids = seedBook(tb, rng)
    expect(tb.levels('buy', 1)[0].price).toBe(START_MID - 1)
    expect(tb.levels('sell', 1)[0].price).toBe(START_MID + 1)
    let traded = 0
    for (let i = 0; i < 5000; i++) {
      flowStep(tb, rng, ids)
      traded += tb.takeTrades().length
      const bid = tb.levels('buy', 1)[0], ask = tb.levels('sell', 1)[0]
      if (bid && ask) expect(bid.price).toBeLessThan(ask.price)
    }
    expect(traded).toBeGreaterThan(100)
    expect(tb.orderCount()).toBeLessThan(200)
  })
  it('builds the timed stream with the stated mix, and the engine gives the same trades every time', () => {
    const timed = 100_000
    const ops = timedStream(timed, mulberry32(1))
    const kinds = [0, 0, 0]
    let crossing = 0
    for (let n = PREFILL; n < PREFILL + timed; n++) {
      kinds[ops[n * 4]]++
      const side = ops[n * 4 + 1], price = ops[n * 4 + 2]
      if (ops[n * 4] === 0 && (side === 0 ? price > 100_000 : price < 100_000)) crossing++
    }
    const share = (x: number): number => Math.round((x / timed) * 100)
    expect([share(kinds[0] - crossing), share(crossing), share(kinds[1]), share(kinds[2])]).toEqual([50, 4, 3, 43])
    const run = (): number => { const tb = make(); tb.run(ops, 0, PREFILL); return tb.run(ops, PREFILL, PREFILL + timed) }
    const trades = run()
    expect(trades).toBeGreaterThan(1000)
    expect(run()).toBe(trades)
  })
})
