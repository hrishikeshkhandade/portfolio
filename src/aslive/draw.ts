import { BONES, PALM_BONES } from '../hand/skeleton'
import type { HandStyle } from '../hand/draw'

export type Pt2 = [number, number]

/** 63 model values (x, y, z per landmark, y growing downward) to 21 flat points. */
export const toPoints = (values: ArrayLike<number>): Pt2[] =>
  Array.from({ length: 21 }, (_, i): Pt2 => [values[i * 3], values[i * 3 + 1]])

export const lerpPoints = (a: Pt2[], b: Pt2[], t: number): Pt2[] =>
  a.map(([x, y], i): Pt2 => [x + (b[i][0] - x) * t, y + (b[i][1] - y) * t])

export interface Box { x: number; y: number; w: number; h: number }

const bounds = (pts: Pt2[]): [minX: number, minY: number, maxX: number, maxY: number] => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
  return [minX, minY, maxX, maxY]
}

/**
 * Pixels per landmark unit that make this hand fill the box. The model's units are relative to the
 * wrist-to-middle-fingertip distance, so hands with a straight middle finger come out small and
 * fists come out large; fitting each to its box shows them all at a readable size.
 */
export function fitScale(pts: Pt2[], box: Box, margin = 0.84): number {
  const [minX, minY, maxX, maxY] = bounds(pts)
  return Math.min(box.w / Math.max(maxX - minX, 1e-6), box.h / Math.max(maxY - minY, 1e-6)) * margin
}

/** How much of a square the hand's outline covers once fitted; higher means a clearer, less edge-on view. */
export function legibility(pts: Pt2[]): number {
  const [minX, minY, maxX, maxY] = bounds(pts)
  const w = maxX - minX, h = maxY - minY
  return Math.min(w, h) / Math.max(w, h, 1e-6)
}

/** Draws 21 landmarks centered in a box, in the same line-and-dot style as the landing hand. */
export function drawPoints(ctx: CanvasRenderingContext2D, pts: Pt2[], box: Box, style: HandStyle, dot = 3, scale = fitScale(pts, box)): void {
  const [minX, minY, maxX, maxY] = bounds(pts)
  const ox = box.x + box.w / 2 - ((minX + maxX) / 2) * scale, oy = box.y + box.h / 2 - ((minY + maxY) / 2) * scale
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
    ctx.arc(x, y, i === 0 ? dot * 1.15 : dot, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  })
}
