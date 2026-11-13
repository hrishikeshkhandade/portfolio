import type { Scene } from '../engine/scene'
import { el, projectSection, projectText, workById } from './shell'
import type { HandStyle } from '../hand/draw'
import { drawPoints, legibility, toPoints, type Pt2 } from '../aslive/draw'
import { normalizeLandmarks, parseForest, topK, type Forest } from '../aslive/forest'
import { samples } from '../aslive/samples'

/** The alphabet chart: every sign the model knows, in reading order. */
const SIGNS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'SPACE']
const HINT = '26 letters and space, as real hands from the training data. Point at one to see what the model says.'
/** As in the app: a letter is typed after this many consecutive frames agree on it. */
const HOLD_FRAMES = 12
const MIN_CONFIDENCE = 0.5
const MAX_OUTPUT = 28
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm'
const TRACKER_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const FOREST_URL = '/models/aslive-rf.bin'

type Top = [letter: string, probability: number][]
type Hand = { x: number; y: number; z: number }[]
type FromWorker = { type: 'ready' } | { type: 'error'; message: string } | { type: 'hand'; landmarks: Hand | null }
/** Longest side of the frame sent to the tracker; it downsizes internally anyway. */
const FRAME_SIDE = 320
const START_TIMEOUT_MS = 45_000

function readStyle(): Required<HandStyle> {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string): string => s.getPropertyValue(name).trim()
  return { ink: v('--ink'), faint: v('--ink-faint'), paper: v('--paper'), soft: v('--ink-soft'), wash: v('--wash') }
}

export function createAslive(): Scene {
  const work = workById('aslive')

  let section: HTMLElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, video: HTMLVideoElement
  let rows: { li: HTMLLIElement; ch: HTMLElement; bar: HTMLElement; p: HTMLElement }[] = []
  let outEl: HTMLElement, capEl: HTMLElement, msgEl: HTMLElement, button: HTMLButtonElement, edit: HTMLElement
  let readEl: HTMLElement, infoEl: HTMLElement
  let observer: ResizeObserver | null = null
  let style = readStyle()
  let width = 0, height = 0, raf = 0, running = false

  // chart state: 7 columns on wide screens, 5 on phones
  let hovered = -1, COLS = 7, ROWS = 4
  let shown: Pt2[] = toPoints(samples.A[0].points)
  let palm = 0.55

  // camera state
  let mode: 'chart' | 'loading' | 'camera' = 'chart'
  let stream: MediaStream | null = null, worker: Worker | null = null, forest: Forest | null = null
  let lastVideoTime = -1, busy = false, streak = 0, streakLabel = '', lastTyped = '', output = ''

  function setRows(top: Top, values: number[], chosen: boolean): void {
    rows.forEach((row, i) => {
      row.ch.textContent = top[i]?.[0] === 'SPACE' ? '␣' : top[i]?.[0] ?? ''
      row.bar.style.transform = `scaleX(${Math.max(0, Math.min(1, values[i] ?? 0)).toFixed(3)})`
      row.p.textContent = (values[i] ?? 0).toFixed(2)
      row.li.classList.toggle('chosen', chosen && i === 0)
    })
  }

  function setOutput(text: string): void {
    output = text.slice(-MAX_OUTPUT)
    outEl.firstChild!.textContent = output
  }

  const label = (sign: string): string => (sign === 'SPACE' ? 'space' : sign)
  // For each sign, the bundled sample seen most face-on, so the chart is as readable as the data allows.
  const chart = SIGNS.map((sign) => {
    const best = samples[sign].reduce((a, b) => (legibility(toPoints(b.points)) > legibility(toPoints(a.points)) ? b : a))
    return { sign, points: toPoints(best.points), top: best.top }
  })

  /** Which chart cell a canvas position falls in, or -1. */
  function cellAt(x: number, y: number): number {
    const col = Math.floor(x / (width / COLS)), row = Math.floor(y / (height / ROWS))
    const i = row * COLS + col
    return col >= 0 && col < COLS && row >= 0 && row < ROWS && i < SIGNS.length ? i : -1
  }

  function hover(index: number): void {
    if (index === hovered || mode === 'camera') return
    hovered = index
    if (index < 0) { infoEl.textContent = HINT; draw(); return }
    const { sign, top } = chart[index]
    infoEl.textContent = `${label(sign)} — model says ${top.map(([l, p]) => `${label(l)} ${p.toFixed(2)}`).join(' · ')}`
    draw()
  }

  function drawChart(): void {
    const cw = width / COLS, ch = height / ROWS
    ctx.font = "11px 'IBM Plex Mono', ui-monospace, monospace"
    ctx.textBaseline = 'top'
    chart.forEach(({ sign, points }, i) => {
      const x = (i % COLS) * cw, y = Math.floor(i / COLS) * ch
      if (i === hovered) { ctx.fillStyle = style.wash; ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4) }
      drawPoints(ctx, points, { x: x + 10, y: y + 22, w: cw - 20, h: ch - 30 }, style, Math.max(1.2, Math.min(2.2, cw / 60)))
      ctx.fillStyle = i === hovered ? style.ink : style.soft
      ctx.fillText(label(sign), x + 8, y + 7)
    })
  }

  /** Sends the newest camera frame to the tracker, one at a time so frames never queue up. */
  function camera(now: number): void {
    if (!worker || busy || video.readyState < 2 || video.currentTime === lastVideoTime) return
    lastVideoTime = video.currentTime
    busy = true
    const k = FRAME_SIDE / Math.max(video.videoWidth, video.videoHeight, 1)
    const target = worker
    createImageBitmap(video, { resizeWidth: Math.round(video.videoWidth * k), resizeHeight: Math.round(video.videoHeight * k) })
      .then((bitmap) => {
        if (worker === target) target.postMessage({ type: 'frame', bitmap, time: now }, [bitmap])
        else bitmap.close()
      })
      .catch(() => { busy = false })
  }

  function onHand(hand: Hand | null): void {
    busy = false
    if (mode !== 'camera' || !forest) return
    if (!hand) {
      msgEl.textContent = 'Show one hand to the camera.'
      streak = 0
      lastTyped = ''
      setRows([], [], false)
      return
    }
    msgEl.textContent = ''
    // The app mirrors the camera image before tracking; do the same so the model sees what it was trained on.
    const features = normalizeLandmarks(hand.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z })))
    const probs = forest.predict(features)
    const order = topK(probs, 4)
    const top: Top = order.map((i) => [forest!.classes[i], probs[i]])
    shown = toPoints(features)
    // Wrist to middle knuckle barely changes as fingers move, unlike the model's own unit.
    palm = Math.hypot(features[27], features[28], features[29]) || palm
    const [label, confidence] = top[0]
    streak = label === streakLabel ? streak + 1 : 1
    streakLabel = label
    const settled = streak >= HOLD_FRAMES && confidence >= MIN_CONFIDENCE
    setRows(top, top.map(([, p]) => p), settled)
    if (settled && label !== lastTyped) {
      lastTyped = label
      setOutput(output + (label === 'SPACE' ? ' ' : label.toLowerCase()))
    }
  }

  /** Starts the background tracker and resolves once it has loaded and warmed up. */
  function startTracker(): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = new Worker(new URL('../aslive/tracker.worker.ts', import.meta.url), { type: 'module' })
      worker = w
      const timer = setTimeout(() => reject(new Error('timeout')), START_TIMEOUT_MS)
      w.onmessage = (event: MessageEvent<FromWorker>) => {
        const m = event.data
        if (m.type === 'ready') { clearTimeout(timer); resolve() }
        else if (m.type === 'hand') onHand(m.landmarks)
        else if (mode === 'camera') { busy = false } else { clearTimeout(timer); reject(new Error(m.message)) }
      }
      w.onerror = () => { clearTimeout(timer); reject(new Error('worker')) }
      w.postMessage({ type: 'init', wasm: WASM, model: TRACKER_MODEL })
    })
  }

  function draw(): void {
    ctx.clearRect(0, 0, width, height)
    if (mode === 'camera') drawPoints(ctx, shown, { x: 0, y: 0, w: width, h: height }, style, 3, Math.min(width, height) / (palm * 4.4))
    else drawChart()
  }

  function frame(now: number): void {
    if (!running) return
    camera(now)
    draw()
    raf = requestAnimationFrame(frame)
  }

  function resize(): void {
    const box = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = box.width
    height = box.height
    COLS = width < 420 ? 5 : 7
    ROWS = Math.ceil(SIGNS.length / COLS)
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    draw()
  }

  function stopCamera(note = ''): void {
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    worker?.terminate()
    worker = null
    busy = false
    video.srcObject = null
    video.hidden = true
    mode = 'chart'
    stop()
    setOutput('')
    readEl.hidden = true
    infoEl.hidden = false
    hovered = -1
    infoEl.textContent = HINT
    section.classList.remove('is-live')
    button.disabled = false
    button.textContent = 'Try with your camera'
    capEl.textContent = 'the alphabet, as the model learned it'
    capEl.classList.remove('live')
    if (ctx) draw()
    edit.hidden = true
    msgEl.textContent = note
  }

  async function startCamera(): Promise<void> {
    mode = 'loading'
    button.disabled = true
    msgEl.textContent = 'Waiting for camera permission…'
    try {
      // Ask for the camera first so a refusal costs nothing to download.
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      msgEl.textContent = 'Loading hand tracking and the ASLive model…'
      const [buffer] = await Promise.all([
        fetch(FOREST_URL).then((r) => { if (!r.ok) throw new Error('model'); return r.arrayBuffer() }),
        startTracker(),
      ])
      forest = parseForest(buffer)
      if (!stream) return
      video.srcObject = stream
      video.hidden = false
      await video.play()
      mode = 'camera'
      readEl.hidden = false
      infoEl.hidden = true
      section.classList.add('is-live')
      streak = 0
      lastTyped = ''
      setOutput('')
      button.disabled = false
      button.textContent = 'Stop camera'
      capEl.textContent = 'live · your hand, the real ASLive model'
      capEl.classList.add('live')
      edit.hidden = false
      msgEl.textContent = ''
      start()
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      const missing = error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'OverconstrainedError')
      stopCamera(denied ? 'Camera permission was not given.' : missing ? 'No camera found.' : 'Hand tracking could not start.')
    }
  }

  /** Removes the last recognized letter. The current sign is not retyped until the hand changes shape. */
  function backspace(): void {
    if (mode !== 'camera' || !output) return
    setOutput(output.slice(0, -1))
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Backspace' && mode === 'camera') { e.preventDefault(); backspace() }
  }

  const onPalette = (): void => { style = readStyle(); draw() }
  const onVisibility = (): void => { if (document.hidden) stop(); else start() }

  /** Only the live camera needs a frame loop; the chart is drawn once and on hover. */
  function start(): void {
    if (running || document.hidden || mode !== 'camera') return
    running = true
    raf = requestAnimationFrame(frame)
  }
  function stop(): void {
    running = false
    cancelAnimationFrame(raf)
  }

  return {
    mount(root) {
      section = projectSection('aslive')
      const text = projectText(work)

      const demo = el('div', 'p-demo')
      const hand = el('div', 'hand')
      video = el('video')
      video.muted = true
      video.playsInline = true
      video.hidden = true
      video.setAttribute('aria-hidden', 'true')
      canvas = el('canvas')
      canvas.setAttribute('aria-hidden', 'true')
      hand.append(video, canvas, el('p', 'cap cap-top', '21 landmarks · 63 features'))
      capEl = el('p', 'cap cap-bot', 'the alphabet, as the model learned it')
      hand.append(capEl)

      const read = el('div', 'a-read')
      readEl = read
      read.hidden = true
      infoEl = el('p', 'a-info', HINT)
      infoEl.setAttribute('aria-live', 'polite')
      const list = el('ol', 'cands live')
      list.setAttribute('aria-hidden', 'true')
      for (let i = 0; i < 4; i++) {
        const li = el('li'), ch = el('span', 'ch'), barWrap = el('span', 'bar'), bar = el('i'), p = el('span', 'p')
        barWrap.append(bar)
        li.append(ch, barWrap, p)
        list.append(li)
        rows.push({ li, ch, bar, p })
      }
      outEl = el('p', 'a-out')
      outEl.append(document.createTextNode(''), el('span', 'caret'))
      outEl.setAttribute('aria-label', 'Letters recognized')
      const label = el('p', 'label', 'model output')
      const top = el('div')
      top.append(label, list)
      read.append(top, outEl)

      const foot = el('div', 'a-foot')
      const ctl = el('div', 'a-ctl')
      button = el('button', 'key primary', 'Try with your camera')
      button.type = 'button'
      msgEl = el('span', 'a-msg')
      msgEl.setAttribute('aria-live', 'polite')
      edit = el('span', 'a-edit')
      edit.hidden = true
      const back = el('button', 'key', '⌫ Backspace')
      back.type = 'button'
      back.addEventListener('click', backspace)
      const clear = el('button', 'key', 'Clear')
      clear.type = 'button'
      clear.addEventListener('click', () => { setOutput(''); lastTyped = '' })
      edit.append(back, clear)
      ctl.append(button, edit, el('span', '', 'Runs in your browser. Video never leaves your device.'), msgEl)
      foot.append(ctl, el('p', 'a-pipe', 'camera → 21 landmarks → 63 features → 100 trees → letter'))
      demo.append(hand, infoEl, read, foot)

      section.append(text, demo)
      root.append(section)

      ctx = canvas.getContext('2d')!
      button.addEventListener('click', () => { if (mode === 'camera') stopCamera(); else if (mode === 'chart') void startCamera() })
      const point = (e: PointerEvent): void => { const box = canvas.getBoundingClientRect(); hover(cellAt(e.clientX - box.left, e.clientY - box.top)) }
      canvas.addEventListener('pointermove', point)
      canvas.addEventListener('pointerdown', point)
      canvas.addEventListener('pointerleave', () => hover(-1))
      if (!navigator.mediaDevices?.getUserMedia) { button.disabled = true; msgEl.textContent = 'This browser has no camera access.' }
      document.addEventListener('palettechange', onPalette)
      document.addEventListener('visibilitychange', onVisibility)
      window.addEventListener('keydown', onKey)
      observer = new ResizeObserver(resize)
      observer.observe(canvas)
      resize()

    },
    start,
    stop,
    destroy() {
      stop()
      if (stream || worker) stopCamera()
      observer?.disconnect()
      document.removeEventListener('palettechange', onPalette)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('keydown', onKey)
      section.remove()
    },
  }
}
