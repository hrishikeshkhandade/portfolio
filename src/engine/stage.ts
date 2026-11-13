import type { Scene } from './scene'
import { createRouter, createWheelGate, hashFor, indexFromHash, type Route, type Router } from './router'

export interface SceneDef extends Route {
  load(): Promise<Scene> | Scene
}

const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/**
 * Shows one scene at a time inside `root`, and wires keyboard, wheel, swipe, the address bar and
 * the numbered markers to move between scenes.
 */
export function createStage(root: HTMLElement, markers: HTMLElement, defs: SceneDef[], baseTitle: string): Router {
  let current: Scene | null = null
  let token = 0
  let followingAddress = false

  const buttons = defs.map((def, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'marker'
    b.setAttribute('aria-label', `${i + 1}: ${def.title}`)
    b.addEventListener('click', () => router.go(i))
    markers.append(b)
    return b
  })

  async function show(index: number): Promise<void> {
    const mine = ++token
    current?.stop()
    current?.destroy()
    current = null
    root.replaceChildren()
    buttons.forEach((b, i) => {
      b.textContent = i === index ? '[ ]' : `[${i + 1}]`
      if (i === index) b.setAttribute('aria-current', 'page')
      else b.removeAttribute('aria-current')
    })
    document.title = index === 0 ? baseTitle : `${defs[index].title} — ${baseTitle.split(' — ')[0]}`
    document.documentElement.dataset.scene = defs[index].id
    const scene = await defs[index].load()
    if (mine !== token) return
    current = scene
    scene.mount(root)
    scene.start()
  }

  const router = createRouter(defs, (index) => {
    if (!followingAddress) history.pushState(null, '', hashFor(defs, index) || location.pathname + location.search)
    void show(index)
  }, indexFromHash(defs, location.hash))

  /** True when the scene has its own scroll area that can still move in this direction. */
  const sceneCanScroll = (dir: 1 | -1): boolean => {
    const el = root.querySelector<HTMLElement>('[data-scroll]')
    if (!el || el.scrollHeight <= el.clientHeight + 1) return false
    return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
    if (/^[1-9]$/.test(e.key)) { if (router.go(Number(e.key) - 1)) e.preventDefault(); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') { if (router.next()) e.preventDefault() }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') { if (router.prev()) e.preventDefault() }
  })

  const gate = createWheelGate()
  window.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
    const dir = e.deltaY > 0 ? 1 : -1
    if (sceneCanScroll(dir)) return
    const step = gate(e.deltaY, performance.now())
    if (step > 0) router.next()
    else if (step < 0) router.prev()
  }, { passive: true })

  let touch: { x: number; y: number; blocked: [boolean, boolean] } | null = null
  window.addEventListener('touchstart', (e) => {
    const t = e.touches[0]
    touch = e.touches.length === 1 && !typing(e.target) ? { x: t.clientX, y: t.clientY, blocked: [sceneCanScroll(-1), sceneCanScroll(1)] } : null
  }, { passive: true })
  window.addEventListener('touchend', (e) => {
    if (!touch) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.x, dy = t.clientY - touch.y
    const { blocked } = touch
    touch = null
    if (Math.abs(dy) < 70 || Math.abs(dy) < Math.abs(dx) * 1.5) return
    if (dy < 0 && !blocked[1]) router.next()
    else if (dy > 0 && !blocked[0]) router.prev()
  }, { passive: true })

  const sync = (): void => {
    const index = indexFromHash(defs, location.hash)
    if (index === router.index) return
    followingAddress = true
    router.go(index)
    followingAddress = false
  }
  window.addEventListener('popstate', sync)
  window.addEventListener('hashchange', sync)

  void show(router.index)
  return router
}
