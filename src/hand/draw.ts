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

/** Bones that run inside the palm; drawn faint because the palm outline already carries the shape. */
const INNER = new Set([0, 4, 8, 12, 16, 20])

/**
 * Shrinks and shifts a view so every given point stays inside the canvas with some padding.
 * Returns the view unchanged when the hand already fits.
 */
export function fit(points: P3[], view: HandView, width: number, height: number, pad: number): HandView {
  const flat = project(points, { ...view, cx: 0, cy: 0, scale: 1, pointer: null })
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of flat) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
  const scale = Math.min(view.scale, (width - pad * 2) / (maxX - minX), (height - pad * 2) / (maxY - minY))
  const clamp = (center: number, lo: number, hi: number, size: number): number =>
    Math.min(size - pad - hi * scale, Math.max(pad - lo * scale, center))
  return { ...view, scale, cx: clamp(view.cx, minX, maxX, width), cy: clamp(view.cy, minY, maxY, height) }
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
  ctx.lineWidth = 1

  // Palm and wrist: a quiet filled shape so the hand has a body, plus two forearm lines.
  path(ctx, palm, true)
  ctx.fillStyle = style.flesh
  ctx.fill()
  ctx.strokeStyle = style.faint
  ctx.stroke()
  for (const [a, b] of [[arm[0], arm[3]], [arm[1], arm[2]]]) {
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.stroke()
  }

  // Bones, far to near, so a finger in front crosses over one behind.
  const bones = BONES.map(([a, b], i) => ({ a, b, i, depth: (p[a][2] + p[b][2]) / 2 })).sort((x, y) => x.depth - y.depth)
  for (const { a, b, i } of bones) {
    if (INNER.has(i)) {
      ctx.strokeStyle = style.faint
      ctx.lineWidth = 1
    } else {
      // A paper-colored halo under each finger bone keeps overlapping fingers legible.
      ctx.strokeStyle = style.paper
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(p[a][0], p[a][1])
      ctx.lineTo(p[b][0], p[b][1])
      ctx.stroke()
      ctx.strokeStyle = style.ink
      ctx.lineWidth = 1.25
    }
    ctx.beginPath()
    ctx.moveTo(p[a][0], p[a][1])
    ctx.lineTo(p[b][0], p[b][1])
    ctx.stroke()
  }

  // Landmarks, far to near; nearer ones slightly larger.
  ctx.lineWidth = 1.25
  ctx.strokeStyle = style.ink
  ctx.fillStyle = style.paper
  const order = p.map((q, i) => ({ q, i })).sort((x, y) => x.q[2] - y.q[2])
  for (const { q, i } of order) {
    const r = (i === 0 ? 3.6 : 3) * (1 + Math.max(-0.2, Math.min(0.35, q[2] * 0.45)))
    ctx.beginPath()
    ctx.arc(q[0], q[1], r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}
