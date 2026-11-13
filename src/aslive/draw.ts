import { BONES, PALM_BONES } from '../hand/skeleton'
import type { HandStyle } from '../hand/draw'

export type Pt2 = [number, number]

/** 63 model values (x, y, z per landmark, y growing downward) to 21 flat points. */
export const toPoints = (values: ArrayLike<number>): Pt2[] =>
  Array.from({ length: 21 }, (_, i): Pt2 => [values[i * 3], values[i * 3 + 1]])

export const lerpPoints = (a: Pt2[], b: Pt2[], t: number): Pt2[] =>
  a.map(([x, y], i): Pt2 => [x + (b[i][0] - x) * t, y + (b[i][1] - y) * t])

/** Draws 21 landmarks centered in a box, in the same line-and-dot style as the landing hand. */
export function drawPoints(ctx: CanvasRenderingContext2D, pts: Pt2[], width: number, height: number, style: HandStyle): void {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
  // Landmarks are in units of wrist-to-middle-fingertip distance, so one fixed scale suits every letter.
  const scale = Math.min(width, height) / 2.9
  const ox = width / 2 - ((minX + maxX) / 2) * scale, oy = height / 2 - ((minY + maxY) / 2) * scale
  const p = pts.map(([x, y]): Pt2 => [ox + x * scale, oy + y * scale])

  ctx.lineWidth = 1
  ctx.lineCap = 'round'
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
