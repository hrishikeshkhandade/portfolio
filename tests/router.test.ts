import { describe, expect, it } from 'vitest'
import { createRouter, createWheelGate, hashFor, indexFromHash } from '../src/engine/router'

const routes = [{ id: 'hand', title: 'Hand' }, { id: 'aslive', title: 'ASLive' }, { id: 'about', title: 'About' }]

describe('router', () => {
  it('maps hashes to routes and falls back to the first', () => {
    expect(indexFromHash(routes, '')).toBe(0)
    expect(indexFromHash(routes, '#aslive')).toBe(1)
    expect(indexFromHash(routes, '#nope')).toBe(0)
    expect(hashFor(routes, 0)).toBe('')
    expect(hashFor(routes, 2)).toBe('#about')
  })
  it('moves by index, id, next and prev, and reports changes', () => {
    const seen: [number, number][] = []
    const r = createRouter(routes, (i, p) => seen.push([i, p]))
    expect(r.go('aslive')).toBe(true)
    expect(r.next()).toBe(true)
    expect(r.next()).toBe(false)
    expect(r.prev()).toBe(true)
    expect(r.go(0)).toBe(true)
    expect(r.prev()).toBe(false)
    expect(seen).toEqual([[1, 0], [2, 1], [1, 2], [0, 1]])
    expect(r.index).toBe(0)
  })
  it('ignores bad targets and staying put', () => {
    const r = createRouter(routes, () => { throw new Error('should not change') }, 1)
    expect(r.index).toBe(1)
    for (const t of [1, 7, -1, 1.5, 'missing', 'aslive']) expect(r.go(t)).toBe(false)
  })
})

describe('wheel gate', () => {
  it('fires once per gesture and then cools down', () => {
    const gate = createWheelGate(80, 700)
    expect(gate(30, 0)).toBe(0)
    expect(gate(30, 16)).toBe(0)
    expect(gate(30, 32)).toBe(1)
    expect(gate(200, 100)).toBe(0)
    expect(gate(200, 600)).toBe(0)
    expect(gate(-200, 800)).toBe(-1)
  })
  it('forgets small movements after a pause', () => {
    const gate = createWheelGate(80, 700)
    expect(gate(60, 0)).toBe(0)
    expect(gate(60, 1000)).toBe(0)
  })
})
