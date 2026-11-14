/**
 * A one-screen-and-a-half platformer level: the rules of the mini Super Scholar demo, with no
 * drawing. Kept pure so tests can prove the level is beatable, the way the full game proves its own.
 */
export interface Rect { x: number; y: number; w: number; h: number }
export interface Input { left: boolean; right: boolean; jump: boolean }
export type Event = 'coin' | 'block' | 'stomp' | 'bump' | 'win'

export const VIEW = { w: 320, h: 180 }
export const WORLD_W = 480
const GROUND_Y = 148
const GRAVITY = 560
const RUN = 84
const JUMP = -245
const BEAR_SPEED = 24

export const SOLIDS: Rect[] = [
  { x: 0, y: GROUND_Y, w: WORLD_W, h: 32 },
  { x: 96, y: 100, w: 48, h: 16 },
  { x: 208, y: 84, w: 48, h: 16 },
  { x: 312, y: 116, w: 32, h: 32 },
]
/** The ? block sits in the middle of the first brick row. */
export const QUESTION_BLOCK: Rect = { x: 112, y: 100, w: 16, h: 16 }
export const FLAG_X = 440
const COINS: [number, number][] = [[100, 82], [132, 82], [224, 66], [244, 66], [322, 98], [384, 130]]

export interface State {
  player: Rect & { vx: number; vy: number; onGround: boolean; facing: 1 | -1 }
  bear: Rect & { dir: 1 | -1; alive: boolean }
  coins: { x: number; y: number; taken: boolean }[]
  score: number
  blockUsed: boolean
  won: boolean
  /** Seconds of protection after bumping into the bear. */
  safe: number
}

export function createState(): State {
  return {
    player: { x: 24, y: GROUND_Y - 14, w: 10, h: 14, vx: 0, vy: 0, onGround: true, facing: 1 },
    bear: { x: 230, y: GROUND_Y - 12, w: 16, h: 12, dir: -1, alive: true },
    coins: COINS.map(([x, y]) => ({ x, y, taken: false })),
    score: 0,
    blockUsed: false,
    won: false,
    safe: 0,
  }
}

const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** Advance the level by dt seconds. Mutates the state and returns what happened. */
export function step(s: State, input: Input, dt: number): Event[] {
  const events: Event[] = []
  if (s.won) return events
  const p = s.player

  p.vx = (input.right ? RUN : 0) - (input.left ? RUN : 0)
  if (p.vx !== 0) p.facing = p.vx > 0 ? 1 : -1
  if (input.jump && p.onGround) { p.vy = JUMP; p.onGround = false }
  p.vy = Math.min(p.vy + GRAVITY * dt, 420)

  p.x = Math.max(0, Math.min(WORLD_W - p.w, p.x + p.vx * dt))
  for (const r of SOLIDS) if (overlap(p, r)) p.x = p.vx > 0 ? r.x - p.w : r.x + r.w

  const feetBefore = p.y + p.h
  p.y += p.vy * dt
  p.onGround = false
  for (const r of SOLIDS) {
    if (!overlap(p, r)) continue
    if (p.vy > 0) { p.y = r.y - p.h; p.onGround = true }
    else {
      p.y = r.y + r.h
      // Bumping the ? block from below opens it once.
      const mid = p.x + p.w / 2
      if (!s.blockUsed && r.y === QUESTION_BLOCK.y && mid >= QUESTION_BLOCK.x - 3 && mid <= QUESTION_BLOCK.x + QUESTION_BLOCK.w + 3) {
        s.blockUsed = true
        events.push('block')
      }
    }
    p.vy = 0
  }

  for (const c of s.coins) {
    if (!c.taken && overlap(p, { x: c.x, y: c.y, w: 8, h: 8 })) { c.taken = true; s.score++; events.push('coin') }
  }

  const b = s.bear
  if (b.alive) {
    b.x += b.dir * BEAR_SPEED * dt
    if (b.x < 168) { b.x = 168; b.dir = 1 }
    if (b.x > 286) { b.x = 286; b.dir = -1 }
    s.safe = Math.max(0, s.safe - dt)
    if (overlap(p, b)) {
      // A stomp means coming down onto the bear from above, not brushing its side mid-hop.
      if (p.vy > 0 && feetBefore <= b.y + 3) {
        b.alive = false
        p.vy = -170
        events.push('stomp')
      } else if (s.safe === 0) {
        // No lives in the demo: the bear just shoves the player back.
        p.x = Math.max(0, p.x + (p.x < b.x ? -22 : 22))
        // A small hop: enough to read as a shove, too low to turn into a stomp.
        p.vy = -90
        s.safe = 0.6
        events.push('bump')
      }
    }
  }

  if (p.x + p.w >= FLAG_X) { s.won = true; events.push('win') }
  return events
}
