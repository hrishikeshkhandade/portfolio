import type { Scene } from '../engine/scene'
import { createMini, type Mini } from '../scholar/mini'
import { el, externalLink, projectSection, projectText, workById } from './shell'

export function createSuperScholar(): Scene {
  const work = workById('super-scholar')
  const shots = work.shots ?? []
  const src = (file: string): string => `/media/super-scholar/${file}.png`

  let section: HTMLElement, mini: Mini, img: HTMLImageElement, caption: HTMLElement, count: HTMLElement
  let shotFrame: HTMLElement, game: HTMLIFrameElement | null = null
  let thumbs: HTMLButtonElement[] = []
  const gameUrl = work.links[0].url

  /** The full game runs from its own site in a frame. It exists only while shown, so leaving it stops its sound. */
  function closeGame(): void {
    game?.remove()
    game = null
  }

  function openGame(): void {
    mini.stop()
    mini.el.hidden = true
    img.hidden = true
    if (!game) {
      game = el('iframe', 'shot-game')
      game.src = gameUrl
      game.title = 'Super Scholar, the full game'
      game.allow = 'fullscreen; autoplay'
      game.referrerPolicy = 'strict-origin-when-cross-origin'
      shotFrame.prepend(game)
    }
    game.focus()
    caption.textContent = 'The full game, running from its own site. Click it to give it the keyboard.'
    count.textContent = ''
    thumbs.forEach((t) => t.setAttribute('aria-pressed', 'false'))
  }

  /** -1 shows the playable level; 0 and up show a screenshot from the full game. */
  function show(index: number): void {
    closeGame()
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
      const playFull = el('button', 'key primary plain', 'Play the full game here')
      playFull.type = 'button'
      playFull.addEventListener('click', openGame)
      links.before(playFull)
      // The first link is the game itself; offer it as a new tab for small screens.
      links.firstElementChild?.replaceWith(externalLink('Open in a new tab', gameUrl))

      const demo = el('div', 'p-demo')
      const frame = el('figure', 'shot')
      shotFrame = frame
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
      closeGame()
      mini.destroy()
      section.remove()
    },
  }
}
