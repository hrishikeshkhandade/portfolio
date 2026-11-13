import '../styles/landing.css'
import type { Scene } from '../engine/scene'
import { site } from '../content/site'
import { easeOut } from '../lib/ease'
import { mulberry32, range, shuffle } from '../lib/rng'
import { createDeck } from '../predict/grammar'
import { browserStore, createRememberedDeck } from '../predict/memory'
import { barsAt, leaderAt, planLetter, type LetterPlan } from '../predict/timeline'
import { drawHand, type HandStyle } from '../hand/draw'
import { LETTERS, REST } from '../hand/poses'
import { landmarks, lerpPose, type Pose, type Pt } from '../hand/skeleton'

const POSE_MS = 240
const GAP_MS = 150
const SPACE_MS = 120
/** Progress at which the winning row is marked as chosen. */
const CHOSEN_AT = 0.72
const END_HOLD_MS = 2600
const MAX_WORD = 16

const isLetter = (ch: string): boolean => /[a-z]/i.test(ch)
const matchCase = (letter: string, like: string): string => (like === like.toLowerCase() ? letter.toLowerCase() : letter)

function readStyle(): HandStyle {
  const s = getComputedStyle(document.documentElement)
  return {
    ink: s.getPropertyValue('--ink').trim(),
    faint: s.getPropertyValue('--ink-faint').trim(),
    paper: s.getPropertyValue('--paper').trim(),
  }
}

export function createLanding(seed: number, replay = false): Scene {
  const rng = mulberry32(seed)
  const mirror = rng() < 0.5
  const side = rng() < 0.5 ? 'left' : 'right'
  const tilt = range(rng, -6, 6)
  const speed = range(rng, 0.85, 1.2)
  // A seed in the address replays one exact run; otherwise the deck continues from this device's last visit.
  const nextSentence = replay
    ? createDeck(rng, site.landing.frames)
    : createRememberedDeck(site.landing.frames, browserStore())
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  let el: HTMLElement
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let rows: { li: HTMLLIElement; ch: HTMLElement; bar: HTMLElement; p: HTMLElement }[] = []
  let doneEl: HTMLElement, tentEl: HTMLElement, srEl: HTMLElement, latEl: HTMLElement
  let spellBtn: HTMLButtonElement, input: HTMLInputElement, list: HTMLElement
  let observer: ResizeObserver | null = null

  let style = readStyle()
  let width = 0, height = 0
  let raf = 0
  let running = false

  let sentence = ''
  let idx = 0
  let plan: LetterPlan | null = null
  let order = [0, 1, 2, 3]
  let planStart = 0
  let holdUntil = 0

  let from: Pose = REST, to: Pose = REST, cur: Pose = REST
  let poseStart = 0
  let pointer: Pt | null = null

  function aim(target: Pose, now: number): void {
    from = cur
    to = target
    poseStart = now
  }

  function begin(text: string): void {
    sentence = text
    idx = 0
    plan = null
    doneEl.textContent = ''
    tentEl.textContent = ''
    srEl.textContent = text
  }

  function showBars(bars: number[], chosen: boolean): void {
    if (!plan) return
    const chars = [plan.letter, ...plan.rivals]
    list.classList.add('live')
    rows.forEach((row, k) => {
      const i = order[k]
      row.ch.textContent = chars[i]
      row.bar.style.transform = `scaleX(${bars[i].toFixed(3)})`
      row.p.textContent = bars[i].toFixed(2)
      row.li.classList.toggle('chosen', chosen && i === 0)
    })
  }

  function startLetter(ch: string, now: number): void {
    plan = planLetter(rng, ch.toUpperCase())
    plan.ms /= speed
    order = shuffle(rng, [0, 1, 2, 3])
    planStart = now
    latEl.textContent = String(Math.round(range(rng, 68, 98)))
    aim(LETTERS[plan.letter], now)
  }

  function advance(now: number): void {
    if (now < holdUntil) return

    if (plan) {
      const t = Math.min(1, (now - planStart) / plan.ms)
      showBars(barsAt(plan, t), t >= CHOSEN_AT && leaderAt(plan, t) === 0)
      const ch = sentence[idx]
      if (t < 1) {
        const lead = leaderAt(plan, t)
        tentEl.textContent = matchCase([plan.letter, ...plan.rivals][lead], ch)
        return
      }
      doneEl.textContent += ch
      tentEl.textContent = ''
      plan = null
      idx++
      holdUntil = now + (idx >= sentence.length ? END_HOLD_MS : GAP_MS)
      return
    }

    if (idx >= sentence.length) {
      begin(nextSentence())
      aim(REST, now)
      holdUntil = now + 400
      return
    }

    const ch = sentence[idx]
    if (isLetter(ch)) {
      startLetter(ch, now)
      return
    }
    doneEl.textContent += ch
    idx++
    if (ch === ' ') { aim(REST, now); holdUntil = now + SPACE_MS / speed }
    if (idx >= sentence.length) holdUntil = now + END_HOLD_MS
  }

  function draw(now: number): void {
    cur = lerpPose(from, to, easeOut((now - poseStart) / (POSE_MS / speed)))
    ctx.clearRect(0, 0, width, height)
    const pts = landmarks({ ...cur, rot: cur.rot + tilt }, mirror)
    drawHand(ctx, pts, { cx: width / 2, cy: height / 2, scale: Math.min(width / 1.9, height / 2.5), pointer }, style)
  }

  function frame(now: number): void {
    if (!running) return
    advance(now)
    draw(now)
    raf = requestAnimationFrame(frame)
  }

  function resize(): void {
    const box = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = box.width
    height = box.height
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (!running) draw(performance.now())
  }

  /** Reduced motion: show a finished sentence, the last letter's pose and its final bars. */
  function showStill(text: string): void {
    begin(text)
    doneEl.textContent = text
    idx = text.length
    const last = [...text].reverse().find(isLetter) ?? 'A'
    plan = planLetter(rng, last.toUpperCase())
    order = shuffle(rng, [0, 1, 2, 3])
    showBars(plan.probs, true)
    from = to = cur = LETTERS[plan.letter]
    draw(performance.now())
  }

  function spell(word: string): void {
    const clean = word.replace(/[^a-z]/gi, '').slice(0, MAX_WORD).toLowerCase()
    input.value = ''
    input.hidden = true
    spellBtn.hidden = false
    if (!clean) return
    if (reduce) { showStill(clean); return }
    begin(clean)
    holdUntil = 0
  }

  const onPalette = (): void => { style = readStyle(); if (!running) draw(performance.now()) }
  const onVisibility = (): void => { if (document.hidden) stop(); else start() }
  const onMove = (e: PointerEvent): void => {
    const box = canvas.getBoundingClientRect()
    pointer = [e.clientX - box.left, e.clientY - box.top]
  }
  const onLeave = (): void => { pointer = null }

  function start(): void {
    if (running || reduce || document.hidden) return
    running = true
    raf = requestAnimationFrame(frame)
  }

  function stop(): void {
    running = false
    cancelAnimationFrame(raf)
  }

  return {
    mount(root) {
      el = document.createElement('section')
      el.className = 'landing'
      el.dataset.side = side
      el.innerHTML = `
        <div class="hand">
          <canvas aria-hidden="true"></canvas>
          <p class="cap cap-top">21 landmarks · 63 features</p>
          <p class="cap cap-bot">latency <span class="lat">84</span> ms</p>
        </div>
        <div class="read">
          <div>
            <p class="label">next letter</p>
            <ol class="cands" aria-hidden="true">
              ${'<li><span class="ch"></span><span class="bar"><i></i></span><span class="p"></span></li>'.repeat(4)}
            </ol>
          </div>
          <p class="sentence" aria-hidden="true"><span class="done"></span><span class="tent"></span><span class="caret"></span></p>
          <p class="sr-only" aria-live="polite"></p>
          <p class="status"></p>
          <div class="spell-row">
            <button class="key spell" type="button">spell a word</button>
            <input class="spell-input" type="text" maxlength="${MAX_WORD}" placeholder="type, then enter"
              autocapitalize="off" autocomplete="off" spellcheck="false" aria-label="Word for the hand to spell" hidden />
          </div>
        </div>`
      root.append(el)

      canvas = el.querySelector('canvas')!
      ctx = canvas.getContext('2d')!
      rows = [...el.querySelectorAll<HTMLLIElement>('.cands li')].map((li) => ({
        li,
        ch: li.querySelector<HTMLElement>('.ch')!,
        bar: li.querySelector<HTMLElement>('.bar i')!,
        p: li.querySelector<HTMLElement>('.p')!,
      }))
      list = el.querySelector('.cands')!
      doneEl = el.querySelector('.done')!
      tentEl = el.querySelector('.tent')!
      srEl = el.querySelector('.sr-only')!
      latEl = el.querySelector('.lat')!
      el.querySelector('.status')!.textContent = site.status
      spellBtn = el.querySelector('.spell')!
      input = el.querySelector('.spell-input')!

      spellBtn.addEventListener('click', () => {
        spellBtn.hidden = true
        input.hidden = false
        input.focus()
      })
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') spell(input.value)
        else if (e.key === 'Escape') spell('')
        e.stopPropagation()
      })
      input.addEventListener('blur', () => { if (!input.hidden && !input.value) spell('') })

      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerleave', onLeave)
      document.addEventListener('palettechange', onPalette)
      document.addEventListener('visibilitychange', onVisibility)
      observer = new ResizeObserver(resize)
      observer.observe(canvas)
      resize()

      if (reduce) showStill(nextSentence())
      else begin(nextSentence())
    },
    start,
    stop,
    destroy() {
      stop()
      observer?.disconnect()
      document.removeEventListener('palettechange', onPalette)
      document.removeEventListener('visibilitychange', onVisibility)
      el.remove()
    },
  }
}
