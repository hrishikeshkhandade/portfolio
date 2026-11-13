import { BONES, PALM_BONES, type Pt } from './skeleton'

export interface HandStyle { ink: string; faint: string; paper: string }

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
