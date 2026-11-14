import type { Scene } from '../engine/scene'
import { createMini, type Mini } from '../scholar/mini'
import { el, externalLink, projectSection, projectText, workById } from './shell'

export function createSuperScholar(): Scene {
  const work = workById('super-scholar')
  const shots = work.shots ?? []
  const src = (file: string): string => `/media/super-scholar/${file}.png`

  let section: HTMLElement, mini: Mini, img: HTMLImageElement, caption: HTMLElement, count: HTMLElement
  let thumbs: HTMLButtonElement[] = []

  /** -1 shows the playable level; 0 and up show a screenshot from the full game. */
  function show(index: number): void {
    const playing = index < 0
    mini.el.hidden = !playing
    img.hidden = playing
    if (playing) {
      mini.start()
      caption.textContent = 'A playable taste: one level, two facts, one question'
      count.textContent = ''
    } else {
      mini.stop()
      const shot = shots[index]
      img.src = src(shot.file)
      img.alt = `Super Scholar screenshot: ${shot.caption}`
      caption.textContent = `From the full game: ${shot.caption}`
      count.textContent = `${index + 1} / ${shots.length}`
    }
    thumbs.forEach((t, i) => t.setAttribute('aria-pressed', String(i - 1 === index)))
  }

  const onVisibility = (): void => { if (document.hidden) mini.stop(); else if (!mini.el.hidden) mini.start() }

  return {
    mount(root) {
      section = projectSection('scholar')
      const text = projectText(work)
      const links = text.querySelector('.p-links')!
      links.before(externalLink('Play the full game', work.links[0].url, 'key primary plain'))
      // The primary button already goes to the game; keep the row for the remaining links.
      links.firstElementChild?.remove()

      const demo = el('div', 'p-demo')
      const frame = el('figure', 'shot')
      mini = createMini(work)
      img = el('img')
      img.width = 800
      img.height = 450
      img.decoding = 'async'
      img.hidden = true
      img.addEventListener('error', () => { caption.textContent = 'Screenshot could not be loaded.' })
      const bar = el('figcaption', 'shot-bar')
      caption = el('span', 'shot-cap')
      caption.setAttribute('aria-live', 'polite')
      count = el('span', 'shot-count')
      bar.append(caption, count)
      frame.append(mini.el, img, bar)

      const strip = el('div', 'thumbs')
      strip.setAttribute('role', 'group')
      strip.setAttribute('aria-label', 'Playable level and screenshots')
      const play = el('button', 'thumb thumb-play', '▶')
      play.type = 'button'
      play.setAttribute('aria-label', 'Show the playable level')
      play.addEventListener('click', () => show(-1))
      strip.append(play)
      thumbs = [play, ...shots.map((shot, i) => {
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
        b.addEventListener('click', () => show(i))
        strip.append(b)
        return b
      })]
      demo.append(frame, strip, el('p', 'a-pipe', 'paper → sections → levels, lessons, questions → boss fight'))
      section.append(text, demo)
      root.append(section)
      document.addEventListener('visibilitychange', onVisibility)
      show(-1)
    },
    start() { if (!mini.el.hidden) mini.start() },
    stop() { mini.stop() },
    destroy() {
      document.removeEventListener('visibilitychange', onVisibility)
      mini.destroy()
      section.remove()
    },
  }
}
