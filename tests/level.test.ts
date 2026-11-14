import { describe, expect, it } from 'vitest'
import { FLAG_X, QUESTION_BLOCK, SOLIDS, createState, step, type Event, type Input, type State } from '../src/scholar/level'

const DT = 1 / 60
const idle: Input = { left: false, right: false, jump: false }

/** Runs right, jumping at walls and at the bear: about what a first-time player does. */
function bot(s: State): Input {
  const p = s.player
  const wallAhead = SOLIDS.some((r) => r.x > p.x && r.x - (p.x + p.w) < 10 && r.y < p.y + p.h && r.y + r.h > p.y)
  const bearAhead = s.bear.alive && s.bear.x > p.x && s.bear.x - (p.x + p.w) < 26
  return { left: false, right: true, jump: p.onGround && (wallAhead || bearAhead) }
}

function play(policy: (s: State) => Input, seconds: number): { state: State; events: Event[] } {
  const state = createState(), events: Event[] = []
  for (let i = 0; i < seconds * 60 && !state.won; i++) events.push(...step(state, policy(state), DT))
  return { state, events }
}

describe('mini level', () => {
  it('is beatable by a simple run-and-jump player within 20 seconds', () => {
    const { state, events } = play(bot, 20)
    expect(state.won).toBe(true)
    expect(events).toContain('win')
    expect(state.player.x + state.player.w).toBeGreaterThanOrEqual(FLAG_X)
  })
  it('keeps the player standing on the ground when idle', () => {
    const { state } = play(() => idle, 2)
    expect(state.player.onGround).toBe(true)
    expect(state.player.y + state.player.h).toBe(SOLIDS[0].y)
    expect(state.won).toBe(false)
  })
  it('jumps high enough to land on the first brick row', () => {
    const s = createState()
    let peak = s.player.y
    step(s, { ...idle, jump: true }, DT)
    for (let i = 0; i < 60; i++) { step(s, idle, DT); peak = Math.min(peak, s.player.y) }
    expect(SOLIDS[0].y - (peak + s.player.h)).toBeGreaterThan(SOLIDS[0].y - SOLIDS[1].y + 2)
  })
  it('opens the ? block once when hit from below', () => {
    const s = createState()
    s.player.x = QUESTION_BLOCK.x + 3
    const events: Event[] = []
    for (let round = 0; round < 2; round++) {
      events.push(...step(s, { ...idle, jump: true }, DT))
      for (let i = 0; i < 70; i++) events.push(...step(s, idle, DT))
    }
    expect(events.filter((e) => e === 'block')).toHaveLength(1)
    expect(s.blockUsed).toBe(true)
  })
  it('stomping the bear removes it; walking into it only pushes back', () => {
    const walk = createState()
    walk.player.x = walk.bear.x - 14
    const bumped: Event[] = []
    for (let i = 0; i < 30; i++) bumped.push(...step(walk, { ...idle, right: true }, DT))
    expect(bumped).toContain('bump')
    expect(walk.bear.alive).toBe(true)

    const drop = createState()
    drop.bear.dir = 1
    drop.bear.x = 176 // clear of the platform overhead
    drop.player.x = drop.bear.x + 3
    drop.player.y = drop.bear.y - 40
    drop.player.onGround = false
    const stomped: Event[] = []
    for (let i = 0; i < 40; i++) stomped.push(...step(drop, idle, DT))
    expect(stomped).toContain('stomp')
    expect(drop.bear.alive).toBe(false)
  })
  it('never lets the player leave the world or sink into a solid', () => {
    const s = createState()
    let seed = 7
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 6000 && !s.won; i++) {
      step(s, { left: rand() < 0.3, right: rand() < 0.6, jump: rand() < 0.1 }, DT)
      const p = s.player
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y + p.h).toBeLessThanOrEqual(SOLIDS[0].y + 0.001)
      for (const r of SOLIDS) expect(p.x < r.x + r.w - 0.001 && p.x + p.w > r.x + 0.001 && p.y < r.y + r.h - 0.001 && p.y + p.h > r.y + 0.001).toBe(false)
    }
  })
  it('collects coins and counts them', () => {
    const { state, events } = play(bot, 20)
    expect(state.score).toBe(events.filter((e) => e === 'coin').length)
    expect(state.score).toBeGreaterThan(0)
  })
})
