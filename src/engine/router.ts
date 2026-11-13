export interface Route {
  /** Used in the address bar after '#'. The first route has no hash. */
  id: string
  title: string
}

export function indexFromHash(routes: Route[], hash: string): number {
  const id = hash.replace(/^#/, '')
  const found = routes.findIndex((r) => r.id === id)
  return found < 0 ? 0 : found
}

export const hashFor = (routes: Route[], index: number): string => (index === 0 ? '' : `#${routes[index].id}`)

export interface Router {
  readonly index: number
  /** Go to a route by position or id. Returns false if already there or out of range. */
  go(target: number | string): boolean
  next(): boolean
  prev(): boolean
}

export function createRouter(routes: Route[], onChange: (index: number, previous: number) => void, start = 0): Router {
  let index = Math.min(Math.max(start, 0), routes.length - 1)
  const go = (target: number | string): boolean => {
    const to = typeof target === 'number' ? target : routes.findIndex((r) => r.id === target)
    if (!Number.isInteger(to) || to < 0 || to >= routes.length || to === index) return false
    const previous = index
    index = to
    onChange(index, previous)
    return true
  }
  return {
    get index() { return index },
    go,
    next: () => go(index + 1),
    prev: () => go(index - 1),
  }
}

/** Turns a stream of wheel deltas into at most one step per gesture. */
export function createWheelGate(threshold = 80, cooldownMs = 700) {
  let sum = 0, last = 0, lockedUntil = 0
  return (deltaY: number, now: number): -1 | 0 | 1 => {
    if (now < lockedUntil) return 0
    if (now - last > 250) sum = 0
    last = now
    sum += deltaY
    if (Math.abs(sum) < threshold) return 0
    const dir = sum > 0 ? 1 : -1
    sum = 0
    lockedUntil = now + cooldownMs
    return dir
  }
}
