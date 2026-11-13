import { BONES, PALM_BONES, type Pt } from './skeleton'

export interface HandStyle { ink: string; faint: string; paper: string; flesh: string }

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
/** Finger thickness in hand units, by first bone index of each finger. */
const GIRTH = [0.2, 0.17, 0.17, 0.16, 0.14]

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

/** Soft silhouette under the skeleton: palm, forearm and thick rounded fingers in one opaque tone. */
function drawFlesh(ctx: CanvasRenderingContext2D, p: Pt[], arm: Pt[], view: HandView, style: HandStyle): void {
  ctx.fillStyle = style.flesh
  ctx.strokeStyle = style.flesh
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const palm = [p[1], p[5], p[9], p[13], p[17], arm[1], arm[2], arm[3], arm[0]]
  ctx.lineWidth = view.scale * 0.14
  ctx.beginPath()
  palm.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  for (let f = 0; f < 5; f++) {
    ctx.lineWidth = view.scale * GIRTH[f]
    ctx.beginPath()
    const start = 1 + f * 4
    ctx.moveTo(p[start][0], p[start][1])
    for (let j = 1; j < 4; j++) ctx.lineTo(p[start + j][0], p[start + j][1])
    ctx.stroke()
  }
}

export function drawHand(ctx: CanvasRenderingContext2D, pts: Pt[], arm: Pt[], view: HandView, style: HandStyle): void {
  const p = project(pts, view)
  drawFlesh(ctx, p, project(arm, view), view, style)

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
