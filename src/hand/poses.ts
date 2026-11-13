import type { Flex, Pose, Thumb } from './skeleton'

const STRAIGHT: Flex = [0, 0, 0]
const FIST: Flex = [88, 100, 65]
const HALF: Flex = [30, 50, 35]
const HOOK: Flex = [15, 95, 60]
const BENT: Flex = [78, 70, 35]
const CLAW: Flex = [55, 105, 70]
const ROUND: Flex = [48, 58, 38]
const DOWN: Flex = [70, 75, 40]
const FORWARD: Flex = [50, 8, 0]

const OUT: Thumb = { az: 60, el: 10, bend: 5 }
const SIDE: Thumb = { az: 10, el: 15, bend: 8 }
const UP: Thumb = { az: 15, el: 35, bend: 5 }
const OPEN: Thumb = { az: 40, el: 40, bend: 15 }
const ACROSS: Thumb = { az: -15, el: 45, bend: 35 }
const TUCK: Thumb = { az: -25, el: 35, bend: 45 }
const PINCH: Thumb = { az: 5, el: 55, bend: 25 }
const ALONG: Thumb = { az: 25, el: 20, bend: 5 }

const pose = (fingers: Pose['fingers'], thumb: Thumb, spread = 0, rot = 0): Pose => ({ fingers, spread, thumb, rot })

export const REST: Pose = pose([[12, 20, 12], [16, 24, 14], [20, 28, 16], [24, 32, 18]], { az: 45, el: 25, bend: 12 }, 0.35)

export const LETTERS: Record<string, Pose> = {
  A: pose([FIST, FIST, FIST, FIST], SIDE),
  B: pose([STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT], ACROSS),
  C: pose([HALF, HALF, HALF, HALF], OPEN, 0.1, -15),
  D: pose([STRAIGHT, DOWN, DOWN, DOWN], PINCH),
  E: pose([CLAW, CLAW, CLAW, CLAW], TUCK),
  F: pose([ROUND, STRAIGHT, STRAIGHT, STRAIGHT], PINCH, 0.6),
  G: pose([STRAIGHT, FIST, FIST, FIST], ALONG, 0, -90),
  H: pose([STRAIGHT, STRAIGHT, FIST, FIST], ACROSS, 0, -90),
  I: pose([FIST, FIST, FIST, STRAIGHT], ACROSS),
  J: pose([FIST, FIST, FIST, STRAIGHT], ACROSS, 0, 25),
  K: pose([STRAIGHT, FORWARD, FIST, FIST], UP, 0.5),
  L: pose([STRAIGHT, FIST, FIST, FIST], OUT),
  M: pose([BENT, BENT, BENT, FIST], TUCK),
  N: pose([BENT, BENT, FIST, FIST], TUCK),
  O: pose([ROUND, ROUND, ROUND, ROUND], PINCH),
  P: pose([STRAIGHT, FORWARD, FIST, FIST], UP, 0.5, 140),
  Q: pose([STRAIGHT, FIST, FIST, FIST], ALONG, 0, 160),
  R: pose([STRAIGHT, STRAIGHT, FIST, FIST], ACROSS, -0.7),
  S: pose([FIST, FIST, FIST, FIST], ACROSS),
  T: pose([BENT, FIST, FIST, FIST], PINCH),
  U: pose([STRAIGHT, STRAIGHT, FIST, FIST], ACROSS, -0.15),
  V: pose([STRAIGHT, STRAIGHT, FIST, FIST], ACROSS, 1),
  W: pose([STRAIGHT, STRAIGHT, STRAIGHT, FIST], ACROSS, 0.9),
  X: pose([HOOK, FIST, FIST, FIST], ACROSS),
  Y: pose([FIST, FIST, FIST, STRAIGHT], OUT, 1),
  Z: pose([STRAIGHT, FIST, FIST, FIST], ACROSS, 0, 15),
}
