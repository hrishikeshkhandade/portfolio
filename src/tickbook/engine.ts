/**
 * Tickbook, the C++ order book, compiled to WebAssembly (public/wasm/tickbook.wasm). This file is the
 * only place that knows the module's C interface: numbers in, and results read back from one buffer
 * of 32-bit integers inside the module's memory. See wasm/tickbook_wasm.cpp in the Tickbook repo.
 */
export type Side = 'buy' | 'sell'
export type Tif = 'GTC' | 'IOC' | 'FOK'
export type Reject = 'none' | 'zero-qty' | 'duplicate-id' | 'fok-not-fillable'

export interface AddResult { id: number; reject: Reject; filled: number; resting: number; cancelled: number }
export interface Level { price: number; qty: number; orders: number }
export interface Resting { id: number; price: number; qty: number }
export interface Trade { seq: number; makerId: number; takerId: number; takerSide: Side; price: number; qty: number }

export interface Tickbook {
  /** Empty book; order ids restart at 1. */
  reset(): void
  addLimit(side: Side, price: number, qty: number, tif?: Tif): AddResult
  addMarket(side: Side, qty: number): AddResult
  /** False when no order with this id is resting. */
  cancel(id: number): boolean
  /** Price levels, best first. */
  levels(side: Side, max: number): Level[]
  /** Resting orders in the order they would trade. */
  resting(side: Side): Resting[]
  /** Trades since the last call, oldest first. */
  takeTrades(): Trade[]
  orderCount(): number
  /**
   * Applies a packed stream of operations without building any JavaScript objects, for timing.
   * Four integers each: [kind, side, price, qty], kind 0 limit, 1 market, 2 cancel (price holds the id).
   * Returns the number of trades.
   */
  run(ops: Int32Array, from: number, to: number): number
}

/** Largest price distance and quantity the demo accepts; the module itself takes any 32-bit value. */
export const MAX_QTY = 1_000_000
export const MAX_PRICE = 1_000_000

interface Exports {
  memory: WebAssembly.Memory
  _initialize?: () => void
  tb_reset(): void
  tb_out(): number
  tb_add_limit(side: number, price: number, qty: number, tif: number): number
  tb_add_market(side: number, qty: number): number
  tb_cancel(id: number): number
  tb_levels(side: number, max: number): number
  tb_resting(side: number): number
  tb_take_trades(): number
  tb_order_count(): number
}

const SIDES: Side[] = ['buy', 'sell']
const TIFS: Tif[] = ['GTC', 'IOC', 'FOK']
const REJECTS: Reject[] = ['none', 'zero-qty', 'duplicate-id', 'fok-not-fillable']

const whole = (name: string, value: number, min: number, max: number): number => {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${name} must be a whole number from ${min} to ${max}`)
  return value
}

/** Wraps one instance of the module. Each instance has its own book. */
export function wrap(instance: WebAssembly.Instance): Tickbook {
  const tb = instance.exports as unknown as Exports
  tb._initialize?.()
  // Built fresh for every read: when the module's memory grows, older views of it stop working.
  const out = (n: number): Int32Array => new Int32Array(tb.memory.buffer, tb.tb_out(), n)
  const u = (x: number): number => x >>> 0
  const result = (id: number): AddResult => {
    const [reject, filled, resting, cancelled] = out(4)
    return { id, reject: REJECTS[reject], filled: u(filled), resting: u(resting), cancelled: u(cancelled) }
  }
  return {
    reset: () => tb.tb_reset(),
    addLimit: (side, price, qty, tif = 'GTC') =>
      result(tb.tb_add_limit(SIDES.indexOf(side), whole('price', price, -MAX_PRICE, MAX_PRICE), whole('quantity', qty, 0, MAX_QTY), TIFS.indexOf(tif))),
    addMarket: (side, qty) => result(tb.tb_add_market(SIDES.indexOf(side), whole('quantity', qty, 0, MAX_QTY))),
    cancel: (id) => tb.tb_cancel(whole('id', id, 0, 0xffffffff)) === 1,
    levels(side, max) {
      const n = tb.tb_levels(SIDES.indexOf(side), max), v = out(n * 3)
      return Array.from({ length: n }, (_, i) => ({ price: v[i * 3], qty: u(v[i * 3 + 1]), orders: u(v[i * 3 + 2]) }))
    },
    resting(side) {
      const n = tb.tb_resting(SIDES.indexOf(side)), v = out(n * 3)
      return Array.from({ length: n }, (_, i) => ({ id: u(v[i * 3]), price: v[i * 3 + 1], qty: u(v[i * 3 + 2]) }))
    },
    takeTrades() {
      const n = tb.tb_take_trades(), v = out(n * 6)
      return Array.from({ length: n }, (_, i) => {
        const o = i * 6
        return { seq: u(v[o]), makerId: u(v[o + 1]), takerId: u(v[o + 2]), takerSide: SIDES[v[o + 3]], price: v[o + 4], qty: u(v[o + 5]) }
      })
    },
    orderCount: () => tb.tb_order_count(),
    run(ops, from, to) {
      let trades = 0
      for (let i = from * 4; i < to * 4; i += 4) {
        const kind = ops[i]
        if (kind === 0) tb.tb_add_limit(ops[i + 1], ops[i + 2], ops[i + 3], 0)
        else if (kind === 1) tb.tb_add_market(ops[i + 1], ops[i + 3])
        else tb.tb_cancel(ops[i + 2])
        // Counts the new trades and empties the engine's log, as a real consumer would after each order.
        trades += tb.tb_take_trades()
      }
      return trades
    },
  }
}

// The module asks for one function from its host: a notice that its memory grew. Nothing to do with it.
const IMPORTS: WebAssembly.Imports = { env: { emscripten_notify_memory_growth: () => {} } }

/** Compiles the module once and returns a maker of fresh, independent books. */
export async function compileTickbook(bytes: BufferSource): Promise<() => Tickbook> {
  const module = await WebAssembly.compile(bytes)
  return () => wrap(new WebAssembly.Instance(module, IMPORTS))
}

export const WASM_URL = '/wasm/tickbook.wasm'

export async function loadTickbook(): Promise<() => Tickbook> {
  const res = await fetch(WASM_URL)
  if (!res.ok) throw new Error(`Could not fetch ${WASM_URL}: ${res.status}`)
  return compileTickbook(await res.arrayBuffer())
}
