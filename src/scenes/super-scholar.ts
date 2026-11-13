import type { Scene } from '../engine/scene'
import { el, externalLink, projectSection, projectText, workById } from './shell'

const ADVANCE_MS = 3400

export function createSuperScholar(): Scene {
  const work = workById('super-scholar')
  const shots = work.shots ?? []
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const src = (file: string): string => `/media/super-scholar/${file}.png`

  let section: HTMLElement, img: HTMLImageElement, caption: HTMLElement, count: HTMLElement
  let thumbs: HTMLButtonElement[] = []
  let index = 0, timer = 0, paused = false

  function show(next: number, byUser = false): void {
    index = (next + shots.length) % shots.length
    const shot = shots[index]
    img.src = src(shot.file)
    img.alt = `Super Scholar screenshot: ${shot.caption}`
    caption.textContent = shot.caption
    count.textContent = `${index + 1} / ${shots.length}`
    thumbs.forEach((t, i) => t.setAttribute('aria-pressed', String(i === index)))
    if (byUser) restart()
  }

  function restart(): void {
    clearInterval(timer)
    if (reduce || paused || document.hidden || shots.length < 2) return
    timer = window.setInterval(() => show(index + 1), ADVANCE_MS)
  }

  const onKey = (e: KeyboardEvent): void => {
    if (!section.contains(document.activeElement) || !(document.activeElement instanceof HTMLButtonElement)) return
    if (e.key === 'ArrowRight') { e.stopPropagation(); show(index + 1, true); thumbs[index].focus() }
    else if (e.key === 'ArrowLeft') { e.stopPropagation(); show(index - 1, true); thumbs[index].focus() }
  }

  return {
    mount(root) {
      section = projectSection('scholar')
      const text = projectText(work)
      const play = externalLink('Play the game', work.links[0].url, 'key primary plain')
      const links = text.querySelector('.p-links')!
      links.before(play)
      // The primary button already goes to the game; keep the row for the remaining links.
      links.firstElementChild?.remove()

      const demo = el('div', 'p-demo')
      const frame = el('figure', 'shot')
      img = el('img')
      img.width = 800
      img.height = 450
      img.decoding = 'async'
      img.addEventListener('error', () => { caption.textContent = 'Screenshot could not be loaded.' })
      const bar = el('figcaption', 'shot-bar')
      caption = el('span', 'shot-cap')
      caption.setAttribute('aria-live', 'polite')
      count = el('span', 'shot-count')
      bar.append(caption, count)
      frame.append(img, bar)

      const strip = el('div', 'thumbs')
      strip.setAttribute('role', 'group')
      strip.setAttribute('aria-label', 'Screenshots')
      thumbs = shots.map((shot, i) => {
        const b = el('button', 'thumb')
        b.type = 'button'
        b.setAttribute('aria-label', `Show screenshot ${i + 1}: ${shot.caption}`)
        const t = el('img')
        t.src = src(shot.file)
        t.alt = ''
        t.loading = 'lazy'
        t.width = 80
        t.height = 45
        b.append(t)
        b.addEventListener('click', () => show(i, true))
        strip.append(b)
        return b
      })
      demo.append(frame, strip, el('p', 'a-pipe', 'paper → sections → levels, lessons, questions → boss fight'))
      for (const node of [frame, strip]) {
        node.addEventListener('pointerenter', () => { paused = true; restart() })
        node.addEventListener('pointerleave', () => { paused = false; restart() })
        node.addEventListener('focusin', () => { paused = true; restart() })
        node.addEventListener('focusout', () => { paused = false; restart() })
      }
      section.append(text, demo)
      root.append(section)
      window.addEventListener('keydown', onKey, true)
      document.addEventListener('visibilitychange', restart)
      show(0)
    },
    start: restart,
    stop() { clearInterval(timer) },
    destroy() {
      clearInterval(timer)
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('visibilitychange', restart)
      section.remove()
    },
  }
}
