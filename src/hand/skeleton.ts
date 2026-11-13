import { lerp } from '../lib/ease'

/** Point in hand space: x toward the pinky, y toward the fingertips, z toward the viewer (out of the palm). */
export type P3 = [number, number, number]
/** Flexion in degrees at the knuckle, middle joint and end joint. */
export type Flex = [number, number, number]

export interface Thumb {
  /** Degrees the thumb swings away from the fingers, in the plane of the palm. */
  az: number
  /** Degrees the thumb lifts out of the palm toward the viewer. */
  el: number
  /** Degrees each thumb joint bends across the palm. */
  bend: number
}

export interface Pose {
  /** [index, middle, ring, pinky] */
  fingers: [Flex, Flex, Flex, Flex]
  /** 0 together, 1 wide, negative crosses fingers. */
  spread: number
  thumb: Thumb
  /** Whole-hand roll in degrees, clockwise positive. */
  rot: number
}

const RAD = Math.PI / 180
const KNUCKLE: P3[] = [[-0.27, 0.95, 0], [-0.03, 1.0, 0], [0.2, 0.95, 0], [0.4, 0.84, 0]]
const LENGTH = [[0.4, 0.25, 0.21], [0.45, 0.29, 0.22], [0.42, 0.27, 0.22], [0.33, 0.19, 0.19]]
const BASE_ANGLE = [-5, 0, 5, 11]
const SPREAD_ANGLE = [-13, -3, 7, 17]
const THUMB_ROOT: P3 = [-0.3, 0.2, 0.06]
const THUMB_LENGTH = [0.4, 0.3, 0.26]
const PIVOT_Y = 0.5

const norm = (v: P3): P3 => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m] }
/** Direction the thumb curls toward: across the palm, slightly down and forward. */
const ACROSS_PALM = norm([0.85, -0.25, 0.45])

export const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

function place(pts: P3[], pose: Pose, mirror: boolean): P3[] {
  const theta = -pose.rot * RAD
  const cos = Math.cos(theta), sin = Math.sin(theta)
  return pts.map(([px, py, pz]): P3 => {
    const dy = py - PIVOT_Y
    const rx = px * cos - dy * sin, ry = PIVOT_Y + px * sin + dy * cos
    return [mirror ? -rx || 0 : rx, ry || 0, pz]
  })
}

/** 21 landmarks in MediaPipe order: 0 wrist, 1-4 thumb, 5-8 index, 9-12 middle, 13-16 ring, 17-20 pinky. */
export function landmarks(pose: Pose, mirror = false): P3[] {
  const pts: P3[] = [[0, 0, 0]]

  const az = pose.thumb.az * RAD, el = pose.thumb.el * RAD
  const d0: P3 = [-Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)]
  const dot = d0[0] * ACROSS_PALM[0] + d0[1] * ACROSS_PALM[1] + d0[2] * ACROSS_PALM[2]
  const u = norm([ACROSS_PALM[0] - dot * d0[0], ACROSS_PALM[1] - dot * d0[1], ACROSS_PALM[2] - dot * d0[2]])
  let p: P3 = [...THUMB_ROOT]
  pts.push(p)
  THUMB_LENGTH.forEach((len, k) => {
    const t = k * pose.thumb.bend * RAD
    const c = Math.cos(t), s = Math.sin(t)
    p = [p[0] + (c * d0[0] + s * u[0]) * len, p[1] + (c * d0[1] + s * u[1]) * len, p[2] + (c * d0[2] + s * u[2]) * len]
    pts.push(p)
  })

  for (let f = 0; f < 4; f++) {
    let q: P3 = [...KNUCKLE[f]]
    pts.push(q)
    const side = (BASE_ANGLE[f] + SPREAD_ANGLE[f] * pose.spread) * RAD
    let flex = 0
    for (let j = 0; j < 3; j++) {
      flex += pose.fingers[f][j] * RAD
      const len = LENGTH[f][j], flat = Math.cos(flex)
      q = [q[0] + Math.sin(side) * flat * len, q[1] + Math.cos(side) * flat * len, q[2] + Math.sin(flex) * len]
      pts.push(q)
    }
  }
  return place(pts, pose, mirror)
}

const PALM: P3[] = [
  [-0.25, 0.02, 0], [-0.41, 0.3, 0], [-0.38, 0.93, 0], [-0.03, 1.03, 0], [0.21, 0.98, 0], [0.49, 0.85, 0], [0.31, 0, 0],
]
const ARM: P3[] = [[-0.25, 0.02, 0], [0.31, 0, 0], [0.29, -0.38, 0], [-0.24, -0.38, 0]]

/** Palm outline and forearm quad [wrist thumb-side, wrist pinky-side, arm pinky-side, arm thumb-side]. */
export function shell(pose: Pose, mirror = false): { palm: P3[]; arm: P3[] } {
  return { palm: place(PALM, pose, mirror), arm: place(ARM, pose, mirror) }
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  if (t <= 0) return a
  if (t >= 1) return b
  return {
    fingers: a.fingers.map((f, i) => f.map((v, j) => lerp(v, b.fingers[i][j], t))) as Pose['fingers'],
    spread: lerp(a.spread, b.spread, t),
    thumb: { az: lerp(a.thumb.az, b.thumb.az, t), el: lerp(a.thumb.el, b.thumb.el, t), bend: lerp(a.thumb.bend, b.thumb.bend, t) },
    rot: lerp(a.rot, b.rot, t),
  }
}
