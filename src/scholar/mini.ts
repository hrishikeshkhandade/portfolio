import type { Work } from '../content/site'
import { FLAG_X, QUESTION_BLOCK, SOLIDS, VIEW, WORLD_W, createState, step, type Input, type State } from './level'

type Mode = 'idle' | 'play' | 'fact' | 'quiz'
const SCALE = 2
const KEYS: Record<string, keyof Input> = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump',
}
const C = {
  sky: '#bdf4e2', band: '#8fe3d0', hillFar: '#3aa34a', hillNear: '#237a33', grass: '#4bc957', dirt: '#5b3a1f', speck: '#7a5230',
  brick: '#e8743b', mortar: '#a8481c', block: '#f2c230', blockUsed: '#b98f3a', coin: '#f6c945', coinEdge: '#b98512',
  bear: '#8a4b22', bearDark: '#5c2f12', cap: '#2b4fd8', skin: '#f2bd8f', ink: '#1b1a17', pole: '#f5f1e6', flag: '#e23b3b',
}

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag)
  n.className = cls
  if (text !== undefined) n.textContent = text
  return n
}

export interface Mini { el: HTMLElement; start(): void; stop(): void; destroy(): void }

/** A 30-second playable taste of Super Scholar: one level, two facts, one question. */
export function createMini(work: Work): Mini {
  const mini = work.mini!
  const root = node('div', 'mini')
  const canvas = node('canvas', 'mini-canvas')
  canvas.width = VIEW.w * SCALE
  canvas.height = VIEW.h * SCALE
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', 'A small platformer level. Run right, jump on the bear, hit the question block and reach the flag.')
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  const hud = node('p', 'mini-hud')
  const startBox = node('div', 'mini-panel mini-start')
  const startBtn = node('button', 'key primary plain', '▶ Play a level')
  startBtn.type = 'button'
  startBox.append(startBtn, node('p', 'mini-hint', 'A / D or arrows to move · W or space to jump · Esc to pause'))

  const factBox = node('div', 'mini-fact')
  factBox.hidden = true
  const factText = node('p', 'mini-fact-text')
  const factBtn = node('button', 'mini-continue', 'continue ↵')
  factBtn.type = 'button'
  factBox.append(node('p', 'mini-fact-label', 'FUN FACT'), factText, factBtn)

  const quiz = node('div', 'mini-panel mini-quiz')
  quiz.hidden = true
  const feedback = node('p', 'mini-feedback')
  feedback.setAttribute('aria-live', 'polite')
  const options = mini.question.options.map((text, i) => {
    const b = node('button', 'mini-option', text)
    b.type = 'button'
    b.addEventListener('click', () => answer(i))
    return b
  })
  const after = node('div', 'mini-after')
  after.hidden = true
  const full = node('a', 'key primary plain', 'Play the full game ↗')
  full.href = work.links[0].url
  full.target = '_blank'
  full.rel = 'noopener'
  const again = node('button', 'key', 'Replay')
  again.type = 'button'
  after.append(full, again)
  quiz.append(node('p', 'mini-fact-label', `QUESTION · ${mini.paper}`), node('p', 'mini-question', mini.question.text), ...options, feedback, after)

  const pad = node('div', 'mini-pad')
  const padButton = (label: string, name: string, key: keyof Input): HTMLButtonElement => {
    const b = node('button', 'key mini-padkey', label)
    b.type = 'button'
    b.setAttribute('aria-label', name)
    const set = (down: boolean) => (e: Event) => { e.preventDefault(); if (mode === 'play') input[key] = down }
    b.addEventListener('pointerdown', set(true))
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, set(false))
    return b
  }
  const moves = node('span', 'mini-moves')
  moves.append(padButton('◀', 'Move left', 'left'), padButton('▶', 'Move right', 'right'))
  pad.append(moves, padButton('Jump', 'Jump', 'jump'))

  const stage = node('div', 'mini-stage')
  stage.append(canvas, hud, factBox, startBox, quiz)
  root.append(stage, pad)

  let state: State = createState()
  let mode: Mode = 'idle'
  const input: Input = { left: false, right: false, jump: false }
  let raf = 0, last = 0, acc = 0, visible = false, clock = 0

  function setMode(next: Mode): void {
    mode = next
    startBox.hidden = next !== 'idle'
    factBox.hidden = next !== 'fact'
    quiz.hidden = next !== 'quiz'
    root.classList.toggle('is-playing', next === 'play')
    input.left = input.right = input.jump = false
    if (next === 'fact') factBtn.focus({ preventScroll: true })
    if (next === 'quiz') options[0].focus({ preventScroll: true })
  }

  function reset(): void {
    state = createState()
    options.forEach((b) => { b.disabled = false; b.classList.remove('right', 'wrong') })
    feedback.textContent = ''
    after.hidden = true
    startBtn.textContent = '▶ Play a level'
  }

  function answer(choice: number): void {
    const { answer: correct, explain } = mini.question
    options.forEach((b, i) => {
      b.disabled = true
      if (i === correct) b.classList.add('right')
      else if (i === choice) b.classList.add('wrong')
    })
    feedback.textContent = `${choice === correct ? 'Right.' : 'Not quite.'} ${explain}`
    after.hidden = false
    full.focus({ preventScroll: true })
  }

  function tick(dt: number): void {
    clock += dt
    for (const event of step(state, input, dt)) {
      if (event === 'block' || event === 'stomp') { factText.textContent = mini.facts[event]; setMode('fact') }
      else if (event === 'win') setMode('quiz')
    }
  }

  const px = (x: number, y: number, w: number, h: number, color: string): void => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x), Math.round(y), w, h)
  }

  function draw(): void {
    const cam = Math.max(0, Math.min(WORLD_W - VIEW.w, state.player.x - 130))
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    px(0, 0, VIEW.w, VIEW.h, C.sky)
    px(0, 0, VIEW.w, 22, C.band)
    const hills = (color: string, parallax: number, size: number, base: number): void => {
      ctx.fillStyle = color
      for (let i = -1; i < 6; i++) {
        const x = i * size * 1.3 - ((cam * parallax) % (size * 1.3))
        ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + size, base - size * 0.62); ctx.lineTo(x + size * 2, base); ctx.fill()
      }
    }
    hills(C.hillFar, 0.25, 70, 148)
    hills(C.hillNear, 0.5, 46, 148)

    ctx.translate(-Math.round(cam), 0)
    for (const r of SOLIDS) {
      if (r.h > 16 && r.y === 148) {
        px(r.x, r.y, r.w, 4, C.grass); px(r.x, r.y + 4, r.w, r.h - 4, C.dirt)
        for (let x = r.x + 5; x < r.x + r.w; x += 13) px(x, r.y + 10 + ((x * 7) % 14), 2, 2, C.speck)
        continue
      }
      for (let x = r.x; x < r.x + r.w; x += 16) for (let y = r.y; y < r.y + r.h; y += 16) {
        const isBlock = x === QUESTION_BLOCK.x && y === QUESTION_BLOCK.y
        if (isBlock) {
          px(x, y, 16, 16, state.blockUsed ? C.blockUsed : C.block); px(x, y, 16, 1, C.ink); px(x, y + 15, 16, 1, C.ink); px(x, y, 1, 16, C.ink); px(x + 15, y, 1, 16, C.ink)
          if (!state.blockUsed) { px(x + 5, y + 3, 6, 2, C.ink); px(x + 9, y + 5, 2, 3, C.ink); px(x + 7, y + 8, 2, 2, C.ink); px(x + 7, y + 11, 2, 2, C.ink) }
        } else {
          px(x, y, 16, 16, C.brick); px(x, y + 7, 16, 1, C.mortar); px(x, y + 15, 16, 1, C.mortar); px(x + 7, y, 1, 7, C.mortar); px(x + 3, y + 8, 1, 7, C.mortar); px(x + 11, y + 8, 1, 7, C.mortar)
        }
      }
    }
    for (const c of state.coins) if (!c.taken) {
      const squash = Math.abs(Math.sin(clock * 5 + c.x)) * 3
      px(c.x + squash / 2, c.y, 8 - squash, 8, C.coinEdge); px(c.x + 1 + squash / 2, c.y + 1, Math.max(1, 6 - squash), 6, C.coin)
    }
    px(FLAG_X, 92, 2, 56, C.pole); px(FLAG_X + 2, 94, 14, 9, C.flag); px(FLAG_X - 2, 146, 6, 2, C.ink)

    const b = state.bear
    if (b.alive) {
      const leg = Math.floor(clock * 8) % 2
      px(b.x, b.y + 2, 16, 8, C.bear); px(b.x + 1, b.y, 4, 3, C.bear); px(b.x + 11, b.y, 4, 3, C.bear)
      px(b.x + (b.dir > 0 ? 11 : 3), b.y + 4, 2, 2, C.ink); px(b.x + 2 + leg, b.y + 10, 3, 2, C.bearDark); px(b.x + 10 - leg, b.y + 10, 3, 2, C.bearDark)
    }
    const p = state.player
    if (state.safe === 0 || Math.floor(clock * 20) % 2) {
      const run = p.onGround && p.vx !== 0 ? Math.floor(clock * 12) % 2 : 0
      px(p.x, p.y, 10, 4, C.cap); px(p.facing > 0 ? p.x + 8 : p.x - 2, p.y + 3, 4, 1, C.cap)
      px(p.x + 1, p.y + 4, 8, 4, C.skin); px(p.facing > 0 ? p.x + 6 : p.x + 2, p.y + 5, 2, 2, C.ink)
      px(p.x + 1, p.y + 8, 8, 4, C.cap); px(p.x + 2 - run, p.y + 12, 2, 2, C.ink); px(p.x + 6 + run, p.y + 12, 2, 2, C.ink)
    }
    hud.textContent = `coins ${state.score} / ${state.coins.length}`
  }

  function frame(now: number): void {
    if (!visible) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (mode === 'play') {
      acc += dt
      while (acc >= 1 / 120) { tick(1 / 120); acc -= 1 / 120 }
    } else clock += dt
    draw()
    raf = requestAnimationFrame(frame)
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (mode === 'play') {
      if (e.key === 'Escape') { setMode('idle'); startBtn.textContent = '▶ Resume'; startBtn.focus({ preventScroll: true }); return }
      const key = KEYS[e.key]
      if (!key) return
      // While a level is being played, movement keys belong to the game, not to scene navigation.
      e.preventDefault()
      e.stopPropagation()
      input[key] = true
    } else if (mode === 'fact' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      e.stopPropagation()
      setMode('play')
    }
  }
  const onKeyUp = (e: KeyboardEvent): void => { const key = KEYS[e.key]; if (key) input[key] = false }
  const onBlur = (): void => { if (mode === 'play') { setMode('idle'); startBtn.textContent = '▶ Resume' } }

  startBtn.addEventListener('click', () => { if (state.won) reset(); setMode('play') })
  factBtn.addEventListener('click', () => setMode('play'))
  again.addEventListener('click', () => { reset(); setMode('play') })
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
  window.addEventListener('blur', onBlur)
  draw()

  return {
    el: root,
    start() {
      if (visible || document.hidden) return
      visible = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    },
    stop() {
      visible = false
      cancelAnimationFrame(raf)
      onBlur()
    },
    destroy() {
      visible = false
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
      root.remove()
    },
  }
}
