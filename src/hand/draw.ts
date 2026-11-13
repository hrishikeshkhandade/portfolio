import { BONES, type P3 } from './skeleton'

export interface HandStyle { ink: string; faint: string; paper: string; flesh: string }

export interface HandView {
  /** Canvas position of the hand's center, in CSS pixels. */
  cx: number
  cy: number
  /** CSS pixels per hand unit. */
  scale: number
  /** View rotation in degrees: yaw turns the hand left/right, pitch tips it toward the viewer. */
  yaw: number
  pitch: number
  pointer: [number, number] | null
}

/** Screen point with depth (larger z is nearer the viewer). */
export type Screen = [x: number, y: number, z: number]

const RAD = Math.PI / 180
const CAMERA = 7
const CENTER_Y = 0.55
const REACH = 140
const LEAN = 5
const OUTLINE = 1.25
/** Width of each digit at its base, in hand units: thumb, index, middle, ring, pinky. */
const GIRTH = [0.25, 0.2, 0.21, 0.195, 0.165]
const TAPER = [1, 0.9, 0.8]

export function project(pts: P3[], view: HandView): Screen[] {
  const cy = Math.cos(view.yaw * RAD), sy = Math.sin(view.yaw * RAD)
  const cp = Math.cos(view.pitch * RAD), sp = Math.sin(view.pitch * RAD)
  return pts.map(([x, y0, z]): Screen => {
    const y = y0 - CENTER_Y
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp
    const k = CAMERA / (CAMERA - z2)
    let px = view.cx + x1 * k * view.scale, py = view.cy - y2 * k * view.scale
    if (view.pointer) {
      const dx = view.pointer[0] - px, dy = view.pointer[1] - py
      const d = Math.hypot(dx, dy)
      if (d > 0.001 && d < REACH) {
        const pull = (1 - d / REACH) * LEAN
        px += (dx / d) * pull
        py += (dy / d) * pull
      }
    }
    return [px, py, z2]
  })
}

function path(ctx: CanvasRenderingContext2D, pts: Screen[], close: boolean): void {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  if (close) ctx.closePath()
}

/** One outlined, filled limb segment: a wide ink stroke with a slightly narrower fill stroke on top. */
function capsule(ctx: CanvasRenderingContext2D, a: Screen, b: Screen, width: number, style: HandStyle): void {
  for (const [color, w] of [[style.ink, width + OUTLINE * 2], [style.flesh, width]] as const) {
    ctx.strokeStyle = color
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.stroke()
  }
}

export function drawHand(
  ctx: CanvasRenderingContext2D,
  pts: P3[],
  shell: { palm: P3[]; arm: P3[] },
  view: HandView,
  style: HandStyle,
): void {
  const p = project(pts, view)
  const palm = project(shell.palm, view)
  const arm = project(shell.arm, view)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Forearm: filled, with only its two long sides inked so it runs off toward the elbow.
  ctx.fillStyle = style.flesh
  path(ctx, arm, true)
  ctx.fill()
  ctx.strokeStyle = style.ink
  ctx.lineWidth = OUTLINE
  for (const [a, b] of [[arm[0], arm[3]], [arm[1], arm[2]]]) {
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.stroke()
  }

  // Digits behind the palm plane first, then the palm, then digits in front, each far-to-near.
  const digits = [0, 1, 2, 3, 4].map((d) => {
    const start = 1 + d * 4
    const joints = [p[start], p[start + 1], p[start + 2], p[start + 3]]
    return { d, joints, depth: (joints[1][2] + joints[2][2] + joints[3][2]) / 3 }
  }).sort((a, b) => a.depth - b.depth)
  const palmDepth = palm.reduce((s, q) => s + q[2], 0) / palm.length

  const drawDigit = ({ d, joints }: (typeof digits)[number]): void => {
    const segs = [0, 1, 2].map((j) => ({ a: joints[j], b: joints[j + 1], w: GIRTH[d] * TAPER[j] * view.scale }))
    if (joints[3][2] < joints[0][2]) segs.reverse()
    for (const s of segs) capsule(ctx, s.a, s.b, s.w, style)
  }
  const drawPalm = (): void => {
    path(ctx, palm, true)
    ctx.fillStyle = style.flesh
    ctx.fill()
    ctx.strokeStyle = style.ink
    ctx.lineWidth = OUTLINE
    ctx.stroke()
  }

  let palmDrawn = false
  for (const digit of digits) {
    if (!palmDrawn && digit.depth >= palmDepth - 0.02) { drawPalm(); palmDrawn = true }
    drawDigit(digit)
  }
  if (!palmDrawn) drawPalm()

  // Tracking overlay: the 21 landmarks and their links.
  ctx.lineWidth = 1
  ctx.strokeStyle = style.faint
  for (const [a, b] of BONES) {
    ctx.beginPath()
    ctx.moveTo(p[a][0], p[a][1])
    ctx.lineTo(p[b][0], p[b][1])
    ctx.stroke()
  }
  ctx.fillStyle = style.ink
  for (const [x, y] of p) {
    ctx.beginPath()
    ctx.arc(x, y, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
}
