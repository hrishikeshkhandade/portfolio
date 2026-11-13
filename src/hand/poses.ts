import type { Pose } from './skeleton'

const OUT = { angle: -70, curl: 0 }
const SIDE = { angle: -18, curl: 0.1 }
const UP = { angle: -8, curl: 0 }
const HALF = { angle: -40, curl: 0.2 }
const ACROSS = { angle: 50, curl: 0.35 }
const TUCK = { angle: 62, curl: 0.6 }
const PINCH = { angle: 30, curl: 0.3 }
const ALONG = { angle: -10, curl: 0.1 }

const pose = (curl: Pose['curl'], thumb: Pose['thumb'], spread = 0, rot = 0): Pose => ({ curl, spread, thumb, rot })

export const REST: Pose = pose([0.25, 0.3, 0.35, 0.4], HALF, 0.3)

export const LETTERS: Record<string, Pose> = {
  A: pose([1, 1, 1, 1], SIDE),
  B: pose([0, 0, 0, 0], ACROSS),
  C: pose([0.45, 0.45, 0.45, 0.45], HALF, 0.2, -20),
  D: pose([0, 0.8, 0.8, 0.8], ACROSS),
  E: pose([0.85, 0.85, 0.85, 0.85], TUCK),
  F: pose([0.75, 0, 0, 0], PINCH, 0.7),
  G: pose([0, 1, 1, 1], ALONG, 0, -90),
  H: pose([0, 0, 1, 1], ACROSS, 0, -90),
  I: pose([1, 1, 1, 0], ACROSS),
  J: pose([1, 1, 1, 0], ACROSS, 0, 25),
  K: pose([0, 0.3, 1, 1], UP, 0.6),
  L: pose([0, 1, 1, 1], OUT),
  M: pose([0.75, 0.75, 0.75, 1], TUCK),
  N: pose([0.75, 0.75, 1, 1], TUCK),
  O: pose([0.6, 0.6, 0.6, 0.6], PINCH),
  P: pose([0, 0.3, 1, 1], UP, 0.6, 140),
  Q: pose([0, 1, 1, 1], ALONG, 0, 160),
  R: pose([0, 0, 1, 1], ACROSS, -0.6),
  S: pose([1, 1, 1, 1], ACROSS),
  T: pose([0.75, 1, 1, 1], PINCH),
  U: pose([0, 0, 1, 1], ACROSS),
  V: pose([0, 0, 1, 1], ACROSS, 1),
  W: pose([0, 0, 0, 1], ACROSS, 1),
  X: pose([0.5, 1, 1, 1], ACROSS),
  Y: pose([1, 1, 1, 0], OUT, 1),
  Z: pose([0, 1, 1, 1], ACROSS, 0, 15),
}
