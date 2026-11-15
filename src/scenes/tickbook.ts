import type { Scene } from '../engine/scene'
import { mulberry32, randomSeed, type Rng } from '../lib/rng'
import { loadTickbook, MAX_PRICE, MAX_QTY, type AddResult, type Level, type Side, type Tickbook, type Tif, type Trade } from '../tickbook/engine'
import { flowStep, PREFILL, seedBook, START_MID, timedStream } from '../tickbook/flow'
import { el, projectSection, projectText, workById } from './shell'

/** Price levels drawn on each side of the book. */
const LEVELS = 5
/** Trades kept on the tape. */
const TAPE = 6
/** One sample order this often while the sample flow is on. */
const FLOW_MS = 700
/** Operations in the timed run, after the untimed prefill. */
const TIMED_OPS = 500_000

type Kind = Tif | 'market'
const KINDS: { kind: Kind; label: string; hint: string }[] = [
  { kind: 'GTC', label: 'limit', hint: 'Trades while prices cross. Whatever is left rests in the book at your price.' },
  { kind: 'IOC', label: 'IOC', hint: 'Immediate or cancel. Trades what it can right now. Whatever is left is dropped.' },
  { kind: 'FOK', label: 'FOK', hint: 'Fill or kill. Trades the whole quantity right now, or does nothing at all.' },
  { kind: 'market', label: 'market', hint: 'No price. Trades against whatever is resting, best price first. Whatever is left is dropped.' },
]

const fmt = (x: number): string => x.toLocaleString('en-US')

/** "20 at 101, 10 at 102": one order's fills, grouped by price in the order they happened. */
export function describeFills(trades: Trade[]): string {
  const byPrice = new Map<number, number>()
  for (const t of trades) byPrice.set(t.price, (byPrice.get(t.price) ?? 0) + t.qty)
  return [...byPrice].map(([price, qty]) => `${fmt(qty)} at ${fmt(price)}`).join(', ')
}

/** What happened to an order, in a sentence. */
export function describeResult(side: Side, kind: Kind, price: number, r: AddResult, fills: Trade[]): string {
  if (r.reject === 'fok-not-fillable') return `Order ${r.id} did nothing. The book cannot fill the whole quantity at that price, and fill or kill takes all or none.`
  if (r.reject !== 'none') return `Order ${r.id} was rejected.`
  const parts: string[] = []
  if (r.filled) parts.push(`${side === 'buy' ? 'bought' : 'sold'} ${describeFills(fills)}`)
  if (r.resting) parts.push(`${fmt(r.resting)} resting at ${fmt(price)}`)
  if (r.cancelled) parts.push(`${fmt(r.cancelled)} dropped, ${kind === 'market' ? 'nothing left to trade against' : 'no more at that price'}`)
  return `Order ${r.id}: ${parts.join('. ')}.`
}

/**
 * Tickbook, live: the C++ matching engine compiled to WebAssembly. The visitor places orders, the
 * engine matches them, and the scene only draws what the engine reports back.
 */
export function createTickbook(): Scene {
  const work = workById('tickbook')
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  let section: HTMLElement, ladder: HTMLElement, tape: HTMLElement, status: HTMLElement, hint: HTMLElement, mineList: HTMLElement
  let priceIn: HTMLInputElement, qtyIn: HTMLInputElement, place: HTMLButtonElement, flowBtn: HTMLButtonElement, timeBtn: HTMLButtonElement, timeOut: HTMLElement
  let sideKeys: HTMLButtonElement[] = [], kindKeys: HTMLButtonElement[] = []

  let make: (() => Tickbook) | null = null
  let tb: Tickbook | null = null
  let rng: Rng = mulberry32(1)
  let flowIds: number[] = []
  const mine = new Set<number>()
  let trades: Trade[] = []
  let side: Side = 'buy', kind: Kind = 'GTC'
  let flowing = !reduce, running = false, timer = 0, destroyed = false

  const num = (input: HTMLInputElement, min: number, max: number): number | null => {
    const v = Number(input.value)
    return input.value.trim() !== '' && Number.isInteger(v) && v >= min && v <= max ? v : null
  }

  function row(side: Side, level: Level | undefined, widest: number, own: Set<number>): HTMLElement {
    const li = el('li', `tk-row tk-${side}`)
    if (!level) { li.classList.add('tk-none'); li.append(el('span', 'tk-price', '·')); return li }
    const pick = el('button', 'tk-price', fmt(level.price))
    pick.type = 'button'
    pick.setAttribute('aria-label', `Use price ${level.price}`)
    pick.addEventListener('click', () => { priceIn.value = String(level.price); renderTicket() })
    const bar = el('span', 'tk-bar')
    const fill = el('i')
    fill.style.width = `${Math.max(2, (level.qty / widest) * 100)}%`
    bar.append(fill)
    li.append(pick, el('span', 'tk-qty', fmt(level.qty)), bar, el('span', 'tk-n', `${level.orders}${own.has(level.price) ? ' · yours' : ''}`))
    return li
  }

  function render(): void {
    if (!tb) return
    const fresh = tb.takeTrades()
    trades = [...trades, ...fresh].slice(-TAPE)
    const bids = tb.levels('buy', LEVELS), asks = tb.levels('sell', LEVELS)
    const widest = Math.max(1, ...bids.map((l) => l.qty), ...asks.map((l) => l.qty))

    // The visitor's own orders, straight from the engine: partly filled ones show what is left.
    const own = { buy: tb.resting('buy').filter((o) => mine.has(o.id)), sell: tb.resting('sell').filter((o) => mine.has(o.id)) }
    const ownBuy = new Set(own.buy.map((o) => o.price)), ownSell = new Set(own.sell.map((o) => o.price))

    const rows: HTMLElement[] = []
    // Asks are listed highest first so the two best prices meet in the middle.
    for (let i = LEVELS - 1; i >= 0; i--) rows.push(row('sell', asks[i], widest, ownSell))
    const gap = el('li', 'tk-gap')
    gap.textContent = bids[0] && asks[0] ? `spread ${fmt(asks[0].price - bids[0].price)}` : bids[0] || asks[0] ? 'one side is empty' : 'the book is empty'
    rows.push(gap)
    for (let i = 0; i < LEVELS; i++) rows.push(row('buy', bids[i], widest, ownBuy))
    ladder.replaceChildren(...rows)

    tape.replaceChildren(...[...trades].reverse().map((t) => {
      const yours = mine.has(t.takerId) || mine.has(t.makerId)
      const li = el('li', yours ? 'tk-yours' : '')
      li.append(el('span', '', `#${t.seq + 1}`), el('span', '', `${t.takerSide === 'buy' ? 'buy' : 'sell'} ${fmt(t.qty)} at ${fmt(t.price)}`), el('span', '', yours ? 'you' : ''))
      return li
    }))
    if (!trades.length) tape.append(el('li', 'tk-quiet', 'no trades yet'))

    const all = [...own.sell.map((o) => ({ ...o, side: 'sell' as Side })), ...own.buy.map((o) => ({ ...o, side: 'buy' as Side }))]
    mineList.replaceChildren(...all.map((o) => {
      const li = el('li')
      const x = el('button', 'key', 'cancel')
      x.type = 'button'
      x.setAttribute('aria-label', `Cancel order ${o.id}`)
      x.addEventListener('click', () => {
        const ok = tb!.cancel(o.id)
        mine.delete(o.id)
        status.textContent = ok ? `Order ${o.id} cancelled.` : `Order ${o.id} had already traded.`
        render()
      })
      li.append(el('span', '', `${o.side} ${fmt(o.qty)} at ${fmt(o.price)}`), x)
      return li
    }))
    if (!all.length) mineList.append(el('li', 'tk-quiet', 'none resting'))
  }

  function renderTicket(): void {
    sideKeys.forEach((b, i) => b.setAttribute('aria-pressed', String((i === 0) === (side === 'buy'))))
    kindKeys.forEach((b, i) => b.setAttribute('aria-pressed', String(KINDS[i].kind === kind)))
    hint.textContent = KINDS.find((k) => k.kind === kind)!.hint
    priceIn.disabled = kind === 'market'
    const qty = num(qtyIn, 1, MAX_QTY), price = num(priceIn, -MAX_PRICE, MAX_PRICE)
    place.disabled = !tb || qty === null || (kind !== 'market' && price === null)
    place.textContent = qty === null ? 'Enter a quantity' : kind === 'market' ? `${side === 'buy' ? 'Buy' : 'Sell'} ${fmt(qty)} at market`
      : price === null ? 'Enter a price' : `${side === 'buy' ? 'Buy' : 'Sell'} ${fmt(qty)} at ${fmt(price)}`
  }

  function submit(): void {
    const qty = num(qtyIn, 1, MAX_QTY), price = num(priceIn, -MAX_PRICE, MAX_PRICE)
    if (!tb || qty === null || (kind !== 'market' && price === null)) return
    // Anything the sample flow did since the last draw is collected first, so the next batch is this order's alone.
    render()
    const r = kind === 'market' ? tb.addMarket(side, qty) : tb.addLimit(side, price!, qty, kind)
    mine.add(r.id)
    const fills = tb.takeTrades()
    trades = [...trades, ...fills].slice(-TAPE)
    status.textContent = describeResult(side, kind, price ?? 0, r, fills)
    render()
  }

  function reset(): void {
    if (!make) return
    tb = make()
    rng = mulberry32(randomSeed())
    mine.clear()
    trades = []
    flowIds = seedBook(tb, rng)
    priceIn.value = String(START_MID)
    status.textContent = 'A sample book. Place an order, or press a price to use it.'
    render()
    renderTicket()
  }

  const tick = (): void => { if (tb) { flowStep(tb, rng, flowIds); render() } }
  function sync(): void {
    clearInterval(timer)
    timer = 0
    if (running && flowing && tb) timer = window.setInterval(tick, FLOW_MS)
    flowBtn.setAttribute('aria-pressed', String(flowing))
    flowBtn.textContent = flowing ? 'sample orders: on' : 'sample orders: off'
  }

  /** Runs a fixed stream through a second, private book and reports how long this browser took. */
  function timeIt(): void {
    if (!make) return
    timeBtn.disabled = true
    timeOut.textContent = 'running…'
    // Let the "running" text paint before the tab is busy.
    setTimeout(() => {
      const book = make!()
      const ops = timedStream(TIMED_OPS, mulberry32(1))
      book.run(ops, 0, PREFILL)
      const t0 = performance.now()
      const made = book.run(ops, PREFILL, PREFILL + TIMED_OPS)
      const ms = performance.now() - t0
      if (destroyed) return
      timeOut.textContent = ms < 1
        ? `${fmt(TIMED_OPS)} operations finished faster than this browser's clock can measure.`
        : `${fmt(TIMED_OPS)} operations in ${ms.toFixed(0)} ms in this tab, ${fmt(made)} trades. About ${(TIMED_OPS / ms / 1000).toFixed(1)} million a second, measured just now on your device, including the call from JavaScript into the engine each time.`
      timeBtn.disabled = false
    }, 30)
  }

  return {
    mount(root) {
      section = projectSection('tickbook')
      const demo = el('div', 'p-demo')

      const head = el('div', 'tk-head')
      flowBtn = el('button', 'key tab')
      flowBtn.type = 'button'
      flowBtn.addEventListener('click', () => { flowing = !flowing; sync() })
      const again = el('button', 'key tab', 'new book')
      again.type = 'button'
      again.addEventListener('click', reset)
      head.append(el('p', 'label', 'order book · price, quantity, orders'), flowBtn, again)

      ladder = el('ol', 'tk-ladder')
      ladder.setAttribute('aria-label', 'Order book: sell orders above, buy orders below')

      const ticket = el('form', 'tk-ticket')
      ticket.noValidate = true
      ticket.addEventListener('submit', (e) => { e.preventDefault(); submit() })
      const sides = el('div', 'tabs')
      sides.setAttribute('role', 'group')
      sides.setAttribute('aria-label', 'Side')
      sideKeys = (['buy', 'sell'] as const).map((s) => {
        const b = el('button', 'key tab', s)
        b.type = 'button'
        b.addEventListener('click', () => { side = s; renderTicket() })
        sides.append(b)
        return b
      })
      const kinds = el('div', 'tabs')
      kinds.setAttribute('role', 'group')
      kinds.setAttribute('aria-label', 'Order type')
      kindKeys = KINDS.map((k) => {
        const b = el('button', 'key tab', k.label)
        b.type = 'button'
        b.addEventListener('click', () => { kind = k.kind; renderTicket() })
        kinds.append(b)
        return b
      })
      const field = (label: string, value: string, min: number, max: number): [HTMLLabelElement, HTMLInputElement] => {
        const wrap = el('label', 'tk-field')
        const input = el('input')
        input.type = 'number'
        input.inputMode = 'numeric'
        input.step = '1'
        input.min = String(min)
        input.max = String(max)
        input.value = value
        input.addEventListener('input', renderTicket)
        wrap.append(el('span', '', label), input)
        return [wrap, input]
      }
      const [priceField, p] = field('price', String(START_MID), -MAX_PRICE, MAX_PRICE)
      const [qtyField, q] = field('quantity', '25', 1, MAX_QTY)
      priceIn = p
      qtyIn = q
      const fields = el('div', 'tk-fields')
      fields.append(priceField, qtyField)
      place = el('button', 'key primary plain')
      place.type = 'submit'
      hint = el('p', 'a-pipe tk-hint')
      const pickers = el('div', 'tk-pick')
      pickers.append(sides, kinds)
      ticket.append(pickers, hint, fields, place)

      status = el('p', 'f-status tk-status', 'Loading the engine…')
      status.setAttribute('aria-live', 'polite')

      const lists = el('div', 'tk-lists')
      const mineBox = el('div'), tapeBox = el('div')
      mineList = el('ul', 'tk-mine')
      tape = el('ol', 'tk-tape')
      mineBox.append(el('p', 'label', 'your resting orders'), mineList)
      tapeBox.append(el('p', 'label', 'trades, newest first'), tape)
      lists.append(tapeBox, mineBox)

      const timing = el('div', 'tk-time')
      timeBtn = el('button', 'key tab', `time ${fmt(TIMED_OPS)} operations in this browser`)
      timeBtn.type = 'button'
      timeBtn.disabled = true
      timeBtn.addEventListener('click', timeIt)
      timeOut = el('p', 'a-pipe')
      timeOut.setAttribute('aria-live', 'polite')
      timing.append(timeBtn, timeOut)

      const main = el('div', 'tk-main')
      main.append(ladder, ticket)
      demo.append(head, main, status, lists, timing)
      section.append(projectText(work), demo)
      root.append(section)
      renderTicket()
      sync()

      loadTickbook().then((maker) => {
        if (destroyed) return
        make = maker
        timeBtn.disabled = false
        reset()
        sync()
      }, () => { status.textContent = 'The engine did not load. Reload the page to try again.' })
    },
    start() { running = true; sync() },
    stop() { running = false; sync() },
    destroy() { destroyed = true; clearInterval(timer); section.remove() },
  }
}
