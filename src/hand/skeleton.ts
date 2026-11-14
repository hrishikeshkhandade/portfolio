import { lerp } from '../lib/ease'

export type Pt = [number, number]

export interface Pose {
  /** Flexion per finger [index, middle, ring, pinky]: 0 straight, 1 fist. */
  curl: [number, number, number, number]
  /** Finger spread: 0 together, 1 wide, negative crosses fingers. */
  spread: number
  /** Thumb direction in degrees from straight up (negative = away from palm) and its flexion. */
  thumb: { angle: number; curl: number }
  /** Whole-hand rotation in degrees, clockwise positive. */
  rot: number
}

const RAD = Math.PI / 180
const KNUCKLE: Pt[] = [[-0.3, 0.92], [-0.08, 1.0], [0.13, 0.95], [0.32, 0.82]]
const LENGTH = [[0.42, 0.26, 0.2], [0.46, 0.3, 0.22], [0.42, 0.27, 0.2], [0.32, 0.2, 0.17]]
const BASE_ANGLE = [-8, -2, 5, 12]
const SPREAD_ANGLE = [-14, -4, 6, 16]
const FLEX = [80, 100, 70]
const THUMB_ROOT: Pt = [-0.34, 0.28]
const THUMB_LENGTH = [0.27, 0.22, 0.18]
/** Oblique projection of depth (toward the viewer) onto the page. */
const DEPTH_X = -0.28
const DEPTH_Y = -0.34
const PIVOT: Pt = [0, 0.5]

export const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]
/** Bones across the palm, drawn fainter. */
export const PALM_BONES = new Set([8, 12, 16])

export function landmarks(pose: Pose, mirror = false): Pt[] {
  const pts: Pt[] = [[0, 0]]

  let [x, y] = THUMB_ROOT
  pts.push([x, y])
  let angle = pose.thumb.angle
  for (const len of THUMB_LENGTH) {
    const drawn = len * (1 - 0.35 * pose.thumb.curl)
    x += Math.sin(angle * RAD) * drawn
    y += Math.cos(angle * RAD) * drawn
    pts.push([x, y])
    angle += 18 + 30 * pose.thumb.curl
  }

  for (let f = 0; f < 4; f++) {
    let [fx, fy] = KNUCKLE[f]
    pts.push([fx, fy])
    const dir = (BASE_ANGLE[f] + SPREAD_ANGLE[f] * pose.spread) * RAD
    let flex = 0
    for (let j = 0; j < 3; j++) {
      flex += pose.curl[f] * FLEX[j] * RAD
      const drawn = LENGTH[f][j] * Math.cos(flex)
      const depth = LENGTH[f][j] * Math.sin(flex)
      fx += Math.sin(dir) * drawn + depth * DEPTH_X
      fy += Math.cos(dir) * drawn + depth * DEPTH_Y
      pts.push([fx, fy])
    }
  }

  const theta = -pose.rot * RAD
  const cos = Math.cos(theta), sin = Math.sin(theta)
  return pts.map(([px, py]): Pt => {
    const dx = px - PIVOT[0], dy = py - PIVOT[1]
    const rx = PIVOT[0] + dx * cos - dy * sin, ry = PIVOT[1] + dx * sin + dy * cos
    return [mirror ? -rx || 0 : rx, ry || 0]
  })
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  if (t <= 0) return a
  if (t >= 1) return b
  return {
    curl: [0, 1, 2, 3].map((i) => lerp(a.curl[i], b.curl[i], t)) as Pose['curl'],
    spread: lerp(a.spread, b.spread, t),
    thumb: { angle: lerp(a.thumb.angle, b.thumb.angle, t), curl: lerp(a.thumb.curl, b.thumb.curl, t) },
    rot: lerp(a.rot, b.rot, t),
  }
}
