import '../styles/project.css'
import type { Scene } from '../engine/scene'
import { site } from '../content/site'
import { easeOut } from '../lib/ease'
import { mulberry32, pick, randomSeed } from '../lib/rng'
import type { HandStyle } from '../hand/draw'
import { drawPoints, lerpPoints, toPoints, type Pt2 } from '../aslive/draw'
import { normalizeLandmarks, parseForest, topK, type Forest } from '../aslive/forest'
import { samples } from '../aslive/samples'

const WORDS = ['ASLIVE', 'HELLO', 'HANDS', 'SIGN', 'UIUC']
const MOVE_MS = 280
const HOLD_MS = 620
const WORD_HOLD_MS = 1500
/** As in the app: a letter is typed after this many consecutive frames agree on it. */
const HOLD_FRAMES = 12
const MIN_CONFIDENCE = 0.5
const MAX_OUTPUT = 28
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm'
const TRACKER_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const FOREST_URL = '/models/aslive-rf.bin'

type Top = [letter: string, probability: number][]
interface Tracker { detectForVideo(video: HTMLVideoElement, time: number): { landmarks: { x: number; y: number; z: number }[][] }; close(): void }

function readStyle(): HandStyle {
  const s = getComputedStyle(document.documentElement)
  return { ink: s.getPropertyValue('--ink').trim(), faint: s.getPropertyValue('--ink-faint').trim(), paper: s.getPropertyValue('--paper').trim() }
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

export function createAslive(): Scene {
  const work = site.work.find((w) => w.id === 'aslive')!
  const rng = mulberry32(randomSeed())
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  let section: HTMLElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, video: HTMLVideoElement
  let rows: { li: HTMLLIElement; ch: HTMLElement; bar: HTMLElement; p: HTMLElement }[] = []
  let outEl: HTMLElement, capEl: HTMLElement, msgEl: HTMLElement, button: HTMLButtonElement
  let observer: ResizeObserver | null = null
  let style = readStyle()
  let width = 0, height = 0, raf = 0, running = false

  // replay state
  let word = '', at = 0, stepStart = 0, typed = false
  let from: Pt2[] = toPoints(samples.A[0].points), to = from, shown = from
  let fromBars = [0, 0, 0, 0], toTop: Top = samples.A[0].top

  // camera state
  let mode: 'replay' | 'loading' | 'camera' = 'replay'
  let stream: MediaStream | null = null, tracker: Tracker | null = null, forest: Forest | null = null
  let lastVideoTime = -1, streak = 0, streakLabel = '', lastTyped = '', output = ''

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

  function nextLetter(now: number): void {
    if (at >= word.length) {
      word = pick(rng, WORDS.filter((w) => w !== word))
      at = 0
      setOutput('')
    }
    const sample = pick(rng, samples[word[at]])
    from = shown
    to = toPoints(sample.points)
    fromBars = toTop.map((_, i) => (i === 0 ? 0.25 : 0.25))
    toTop = sample.top
    stepStart = now
    typed = false
  }

  function replay(now: number): void {
    if (!word) nextLetter(now)
    const elapsed = now - stepStart
    const t = easeOut(elapsed / MOVE_MS)
    shown = lerpPoints(from, to, t)
    setRows(toTop, toTop.map(([, p], i) => fromBars[i] + (p - fromBars[i]) * t), elapsed > MOVE_MS)
    if (!typed && elapsed > MOVE_MS) { typed = true; setOutput(output + word[at].toLowerCase()) }
    const last = at === word.length - 1
    if (elapsed > MOVE_MS + (last ? WORD_HOLD_MS : HOLD_MS)) { at++; nextLetter(now) }
  }

  function camera(now: number): void {
    if (!tracker || !forest || video.readyState < 2 || video.currentTime === lastVideoTime) return
    lastVideoTime = video.currentTime
    const hand = tracker.detectForVideo(video, now).landmarks[0]
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

  function draw(): void {
    ctx.clearRect(0, 0, width, height)
    drawPoints(ctx, shown, width, height, style)
  }

  function frame(now: number): void {
    if (!running) return
    if (mode === 'camera') camera(now)
    else replay(now)
    draw()
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
    draw()
  }

  function stopCamera(note = ''): void {
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    tracker?.close()
    tracker = null
    video.srcObject = null
    video.hidden = true
    mode = 'replay'
    word = ''
    setOutput('')
    button.disabled = false
    button.textContent = 'Try with your camera'
    capEl.textContent = 'replay · real hands from the training data'
    capEl.classList.remove('live')
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
      const [vision, buffer] = await Promise.all([
        import('@mediapipe/tasks-vision'),
        fetch(FOREST_URL).then((r) => { if (!r.ok) throw new Error('model'); return r.arrayBuffer() }),
      ])
      forest = parseForest(buffer)
      const files = await vision.FilesetResolver.forVisionTasks(WASM)
      tracker = await vision.HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: TRACKER_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.65,
        minTrackingConfidence: 0.5,
      })
      if (!stream) return
      video.srcObject = stream
      video.hidden = false
      await video.play()
      mode = 'camera'
      streak = 0
      lastTyped = ''
      setOutput('')
      button.disabled = false
      button.textContent = 'Stop camera'
      capEl.textContent = 'live · your hand, the real ASLive model'
      capEl.classList.add('live')
      msgEl.textContent = ''
      if (reduce && !running) { running = true; raf = requestAnimationFrame(frame) }
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      const missing = error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'OverconstrainedError')
      stopCamera(denied ? 'Camera permission was not given. Replay continues.' : missing ? 'No camera found. Replay continues.' : 'Hand tracking could not start. Replay continues.')
    }
  }

  const onPalette = (): void => { style = readStyle(); draw() }
  const onVisibility = (): void => { if (document.hidden) stop(); else start() }

  function start(): void {
    if (running || document.hidden || (reduce && mode !== 'camera')) return
    running = true
    raf = requestAnimationFrame(frame)
  }
  function stop(): void {
    running = false
    cancelAnimationFrame(raf)
  }

  return {
    mount(root) {
      section = el('section', 'project aslive')
      section.dataset.scroll = ''

      const text = el('div', 'p-text')
      text.append(el('p', 'label', 'project'), el('h2', 'p-title', work.name), el('p', 'p-line', work.summary ?? work.line))
      const stats = el('dl', 'p-stats')
      for (const s of work.stats ?? []) { const d = el('div'); d.append(el('dt', '', s.value), el('dd', '', s.label)); stats.append(d) }
      const links = el('p', 'p-links')
      for (const link of work.links) {
        const a = el('a', '', `${link.label} ↗`)
        a.href = link.url
        a.target = '_blank'
        a.rel = 'noopener'
        a.setAttribute('aria-label', `${link.label} (opens in a new tab)`)
        links.append(a)
      }
      text.append(stats, links)
      if (work.note) text.append(el('p', 'p-note', work.note))

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
      capEl = el('p', 'cap cap-bot', 'replay · real hands from the training data')
      hand.append(capEl)

      const read = el('div', 'a-read')
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
      button = el('button', 'key', 'Try with your camera')
      button.type = 'button'
      msgEl = el('span', 'a-msg')
      msgEl.setAttribute('aria-live', 'polite')
      ctl.append(button, el('span', '', 'Runs in your browser. Video never leaves your device.'), msgEl)
      foot.append(el('p', 'a-pipe', 'camera → 21 landmarks → 63 features → 100 trees → letter'), ctl)
      demo.append(hand, read, foot)

      section.append(text, demo)
      root.append(section)

      ctx = canvas.getContext('2d')!
      button.addEventListener('click', () => { if (mode === 'camera') stopCamera(); else if (mode === 'replay') void startCamera() })
      if (!navigator.mediaDevices?.getUserMedia) { button.disabled = true; msgEl.textContent = 'This browser has no camera access.' }
      document.addEventListener('palettechange', onPalette)
      document.addEventListener('visibilitychange', onVisibility)
      observer = new ResizeObserver(resize)
      observer.observe(canvas)
      resize()

      if (reduce) {
        const sample = samples.A[0]
        shown = toPoints(sample.points)
        setRows(sample.top, sample.top.map(([, p]) => p), true)
        setOutput('a')
        draw()
      }
    },
    start,
    stop,
    destroy() {
      stop()
      if (stream || tracker) stopCamera()
      observer?.disconnect()
      document.removeEventListener('palettechange', onPalette)
      document.removeEventListener('visibilitychange', onVisibility)
      section.remove()
    },
  }
}
