import { BONES, PALM_BONES, type Pt } from './skeleton'

export interface HandStyle { ink: string; faint: string; paper: string; soft?: string; wash?: string }

export interface HandView {
  /** Canvas position of the hand's center, in CSS pixels. */
  cx: number
  cy: number
  /** CSS pixels per hand unit. */
  scale: number
  pointer: Pt | null
}

const REACH = 140
const LEAN = 5

/** Room kept between the hand and the box edge: dot radius, pointer lean and a little air. */
const FIT_PAD = 14

/**
 * Places the hand at `base` scale in the middle of a width × height box, then shrinks and shifts it
 * only as much as needed to keep every landmark inside. Rotated poses (P, Q, G, H) and the turns into
 * them reach well past the upright hand, so a fixed view lets them spill out of the frame. Both steps
 * change smoothly with the pose, so the hand never jumps.
 */
export function fitView(pts: Pt[], width: number, height: number, base: number, pointer: Pt | null): HandView {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const w = Math.max(1, width - 2 * FIT_PAD), h = Math.max(1, height - 2 * FIT_PAD)
  const scale = Math.min(base, w / Math.max(maxX - minX, 1e-6), h / Math.max(maxY - minY, 1e-6))
  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)
  const cx = clamp(width / 2, FIT_PAD - minX * scale, width - FIT_PAD - maxX * scale)
  const cy = clamp(height / 2, FIT_PAD + (maxY - 0.6) * scale, height - FIT_PAD + (minY - 0.6) * scale)
  return { cx, cy, scale, pointer }
}

export function project(pts: Pt[], view: HandView): Pt[] {
  return pts.map(([x, y]): Pt => {
    let px = view.cx + x * view.scale, py = view.cy - (y - 0.6) * view.scale
    if (view.pointer) {
      const dx = view.pointer[0] - px, dy = view.pointer[1] - py
      const d = Math.hypot(dx, dy)
      if (d > 0.001 && d < REACH) {
        const pull = (1 - d / REACH) * LEAN
        px += (dx / d) * pull
        py += (dy / d) * pull
      }
    }
    return [px, py]
  })
}

export function drawHand(ctx: CanvasRenderingContext2D, pts: Pt[], view: HandView, style: HandStyle): void {
  const p = project(pts, view)

  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  BONES.forEach(([a, b], i) => {
    ctx.strokeStyle = PALM_BONES.has(i) || i === 20 ? style.faint : style.ink
    ctx.beginPath()
    ctx.moveTo(p[a][0], p[a][1])
    ctx.lineTo(p[b][0], p[b][1])
    ctx.stroke()
  })

  ctx.fillStyle = style.paper
  ctx.strokeStyle = style.ink
  p.forEach(([x, y], i) => {
    ctx.beginPath()
    ctx.arc(x, y, i === 0 ? 3.5 : 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  })
}
