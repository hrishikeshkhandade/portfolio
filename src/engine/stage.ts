import type { Scene } from './scene'
import { setTint } from '../theme/apply'
import type { Tint } from '../theme/palette'
import { createRouter, createWheelGate, hashFor, indexFromHash, type Route, type Router } from './router'

export interface SceneDef extends Route {
  /** Paper color for this scene; omit for the default. */
  tint?: Tint
  load(): Promise<Scene> | Scene
}

const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/**
 * Shows one scene at a time inside `root`, and wires keyboard, wheel, swipe, the address bar and
 * the numbered markers to move between scenes.
 */
export function createStage(root: HTMLElement, markers: HTMLElement, where: HTMLElement, defs: SceneDef[], baseTitle: string): Router {
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

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const EASE = 'cubic-bezier(0.77, 0, 0.175, 1)'
  const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
  let layer: HTMLElement | null = null
  let shownIndex = -1
  /** Finishes whatever transition is still running, immediately. */
  let settle: () => void = () => {}

  /**
   * Scene change: the old scene lifts away and fades, a hairline carrying the next scene's number
   * sweeps across the stage, and the new scene is uncovered behind it with its parts rising in turn.
   */
  function transition(oldLayer: HTMLElement, oldScene: Scene | null, newLayer: HTMLElement, index: number, dir: 1 | -1): void {
    const h = root.clientHeight
    const sweep = document.createElement('div')
    sweep.className = 'sweep'
    sweep.textContent = `${String(index + 1).padStart(2, '0')} — ${defs[index].title}`
    root.append(sweep)

    const from = dir > 0 ? h : 0, to = dir > 0 ? 0 : h
    const hidden = dir > 0 ? 'inset(100% 0 0 0)' : 'inset(0 0 100% 0)'
    const animations = [
      oldLayer.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: `translateY(${-dir * 28}px)` }], { duration: 260, easing: EASE, fill: 'forwards' }),
      sweep.animate([{ transform: `translateY(${from}px)`, opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { transform: `translateY(${to}px)`, opacity: 0 }], { duration: 620, easing: EASE, fill: 'forwards' }),
      newLayer.animate([{ clipPath: hidden }, { clipPath: 'inset(0 0 0 0)' }], { duration: 620, easing: EASE, fill: 'backwards' }),
    ]
    const parts = [...(newLayer.firstElementChild?.children ?? [])] as HTMLElement[]
    parts.forEach((part, i) => {
      animations.push(part.animate([{ opacity: 0, transform: `translateY(${dir * 22}px)` }, { opacity: 1, transform: 'translateY(0)' }], { duration: 520, delay: 200 + i * 70, easing: OUT, fill: 'backwards' }))
    })

    let done = false
    settle = () => {
      if (done) return
      done = true
      animations.forEach((a) => a.cancel())
      oldScene?.destroy()
      oldLayer.remove()
      sweep.remove()
      settle = () => {}
    }
    void Promise.all(animations.map((a) => a.finished)).then(settle, () => {})
  }

  async function show(index: number): Promise<void> {
    const mine = ++token
    settle()
    const dir: 1 | -1 = index >= shownIndex ? 1 : -1
    const oldScene = current, oldLayer = layer
    oldScene?.stop()
    current = null
    buttons.forEach((b, i) => {
      b.textContent = i === index ? '[\u00a0]' : `[${i + 1}]`
      if (i === index) b.setAttribute('aria-current', 'page')
      else b.removeAttribute('aria-current')
    })
    document.title = index === 0 ? baseTitle : `${defs[index].title} — ${baseTitle.split(' — ')[0]}`
    document.documentElement.dataset.scene = defs[index].id
    where.textContent = `${String(index + 1).padStart(2, '0')} — ${defs[index].title}`
    setTint(defs[index].tint)

    const scene = await defs[index].load()
    if (mine !== token) { oldScene?.destroy(); oldLayer?.remove(); if (layer === oldLayer) layer = null; return }
    const newLayer = document.createElement('div')
    newLayer.className = 'layer'
    root.append(newLayer)
    scene.mount(newLayer)
    scene.start()
    current = scene
    layer = newLayer
    const first = shownIndex < 0
    shownIndex = index

    if (!oldLayer) return
    // A hidden tab does not run animations, so a transition started there would hang half-way.
    if (reduce || first || document.hidden) { oldScene?.destroy(); oldLayer.remove(); return }
    transition(oldLayer, oldScene, newLayer, index, dir)
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
