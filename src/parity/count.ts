/**
 * How many even and odd numbers can be written with a set of digits?
 *
 * Three answers to the same question:
 *  - ratioRule: the first version of the formula, total × (share of even digits). It ignores that a
 *    number cannot start with zero.
 *  - exact: fills the last place first (it alone decides parity), then the first place (not zero),
 *    then the rest. Always right.
 *  - listAll: writes every number out and counts. Slow, and the reference the other two are tested against.
 *
 * Digits are distinct, 0 to 9. A one-digit 0 counts as a number; longer numbers cannot start with 0.
 */
export interface Query {
  digits: readonly number[]
  /** How many digits each number has. */
  length: number
  /** Whether a digit may be used more than once in a number. */
  repeat: boolean
}
export interface Counts { total: number; even: number; odd: number }

/** Ways to fill k ordered places from n distinct things. */
export const perm = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0
  let p = 1
  for (let i = 0; i < k; i++) p *= n - i
  return p
}

export const cleanDigits = (digits: readonly number[]): number[] =>
  [...new Set(digits.filter((d) => Number.isInteger(d) && d >= 0 && d <= 9))].sort((a, b) => a - b)

const shape = (q: Query) => {
  const digits = cleanDigits(q.digits)
  const n = digits.length
  const e = digits.filter((d) => d % 2 === 0).length
  return { digits, n, e, o: n - e, zero: digits[0] === 0, r: Math.floor(q.length) }
}

const NONE: Counts = { total: 0, even: 0, odd: 0 }

export function ratioRule(q: Query): Counts {
  const { n, e, r } = shape(q)
  if (n === 0 || r < 1) return NONE
  const total = q.repeat ? n ** r : perm(n, r)
  const even = (total * e) / n
  return { total, even, odd: total - even }
}

export function exact(q: Query): Counts {
  const { n, e, o, zero, r } = shape(q)
  if (n === 0 || r < 1) return NONE
  if (r === 1) return { total: n, even: e, odd: o }
  const lead = zero ? n - 1 : n
  if (q.repeat) {
    const rest = lead * n ** (r - 2)
    return { total: rest * n, even: rest * e, odd: rest * o }
  }
  if (r > n) return NONE
  if (!zero) {
    const rest = perm(n - 1, r - 1)
    return { total: rest * n, even: rest * e, odd: rest * o }
  }
  // Zero is in the set and cannot lead. An odd last digit leaves n - 2 choices for the first place.
  const total = lead * perm(n - 1, r - 1)
  const odd = o * (n - 2) * perm(n - 2, r - 2)
  return { total, even: total - odd, odd }
}

export interface Listing extends Counts { evens: number[]; odds: number[] }

/** Writes out every number and counts. Keeps the first `keep` of each parity as examples. */
export function listAll(q: Query, keep = 0): Listing {
  const { digits, n, r } = shape(q)
  const out: Listing = { total: 0, even: 0, odd: 0, evens: [], odds: [] }
  if (n === 0 || r < 1) return out
  const used = new Array<boolean>(n).fill(false)
  const place = (at: number, value: number): void => {
    if (at === r) {
      out.total++
      if (value % 2 === 0) { out.even++; if (out.evens.length < keep) out.evens.push(value) }
      else { out.odd++; if (out.odds.length < keep) out.odds.push(value) }
      return
    }
    for (let i = 0; i < n; i++) {
      if (at === 0 && r > 1 && digits[i] === 0) continue
      if (!q.repeat) { if (used[i]) continue; used[i] = true }
      place(at + 1, value * 10 + digits[i])
      if (!q.repeat) used[i] = false
    }
  }
  place(0, 0)
  return out
}

const fmt = (x: number): string => x.toLocaleString('en-US')
const list = (ds: number[]): string => (ds.length < 2 ? ds.join('') : `${ds.slice(0, -1).join(', ')} or ${ds[ds.length - 1]}`)

/** The working behind the exact even count, in plain sentences. */
export function explainEven(q: Query): string[] {
  const { digits, n, e, o, zero, r } = shape(q)
  if (n === 0) return ['Pick at least one digit.']
  if (r === 1) return [`One-digit numbers are the digits themselves: ${e} even, ${o} odd.`]
  if (!q.repeat && r > n) return [`There are only ${n} digits and none may repeat, so no ${r}-digit number exists.`]
  const { even } = exact(q)
  if (e === 0) return ['No even digit can sit in the last place, so no number is even.']
  const evens = digits.filter((d) => d % 2 === 0)
  if (q.repeat) {
    const lead = zero ? n - 1 : n
    const middle = r > 2 ? ` Each of the ${r - 2} middle place${r > 3 ? 's' : ''}: ${n}.` : ''
    const product = [e, lead, ...(r > 2 ? [`${n}^${r - 2}`] : [])].join(' × ')
    return [
      `Last place: ${e} even digit${e > 1 ? 's' : ''} (${list(evens)}). First place: ${lead}${zero ? ', since zero cannot lead' : ''}.${middle}`,
      `${product} = ${fmt(even)} even numbers.`,
    ]
  }
  if (!zero) {
    const rest = perm(n - 1, r - 1)
    return [
      `Last place: ${e} even digit${e > 1 ? 's' : ''} (${list(evens)}). The other ${r - 1} place${r > 2 ? 's' : ''} fill from the ${n - 1} digits left: ${fmt(rest)} ways.`,
      `${e} × ${fmt(rest)} = ${fmt(even)} even numbers.`,
    ]
  }
  const endsZero = perm(n - 1, r - 1)
  const steps = [`Ending in 0: zero is used up, so the other places fill freely, ${fmt(endsZero)} ways.`]
  if (e > 1) {
    const rest = perm(n - 2, r - 2)
    const other = (e - 1) * (n - 2) * rest
    steps.push(
      `Ending in ${list(evens.slice(1))}: the first place cannot be zero or the last digit, so ${e - 1} × ${n - 2} × ${fmt(rest)} = ${fmt(other)}.`,
      `${fmt(endsZero)} + ${fmt(other)} = ${fmt(even)} even numbers.`,
    )
  }
  return steps
}
