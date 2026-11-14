import type { Scene } from '../engine/scene'
import { about } from '../content/about'
import { site } from '../content/site'
import type { HandStyle } from '../hand/draw'
import { drawPoints, legibility, toPoints } from '../aslive/draw'
import { samples } from '../aslive/samples'
import { el, externalLink, projectSection } from './shell'

/** Real hands from the ASLive training data, spelling a greeting. */
const GREETING = ['H', 'I'].map((letter) =>
  toPoints(samples[letter].reduce((a, b) => (legibility(toPoints(b.points)) > legibility(toPoints(a.points)) ? b : a)).points))

function readStyle(): HandStyle {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string): string => s.getPropertyValue(name).trim()
  return { ink: v('--ink'), faint: v('--ink-faint'), paper: v('--paper') }
}

/** The closing scene: who I am, the proof behind it, and where to reach me. Nothing here animates. */
export function createAbout(): Scene {
  let section: HTMLElement
  let canvases: HTMLCanvasElement[] = []
  let observer: ResizeObserver | null = null

  function draw(): void {
    const style = readStyle()
    canvases.forEach((canvas, i) => {
      const box = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(box.width * dpr))
      canvas.height = Math.max(1, Math.round(box.height * dpr))
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, box.width, box.height)
      drawPoints(ctx, GREETING[i], { x: 4, y: 4, w: box.width - 8, h: box.height - 8 }, style, 2)
    })
  }

  return {
    mount(root) {
      section = projectSection('about')

      const text = el('div', 'p-text')
      const hello = el('div', 'hello')
      hello.setAttribute('role', 'img')
      hello.setAttribute('aria-label', 'Two hands fingerspelling H and I')
      canvases = GREETING.map(() => { const c = el('canvas'); hello.append(c); return c })
      const actions = el('p', 'about-actions')
      const resume = el('a', 'key primary plain', 'Read my resume')
      resume.href = '/resume.html'
      actions.append(resume)
      const links = el('p', 'p-links')
      for (const link of site.links) links.append(externalLink(link.label, link.url))
      text.append(el('p', 'label', 'about'), hello, el('p', 'p-line about-intro', about.intro), el('p', 'about-status', site.status), actions, links)

      const side = el('div', 'p-demo about-side')
      const proof = el('dl', 'proof')
      for (const p of about.proof) { const d = el('div'); d.append(el('dt', '', p.value), el('dd', '', p.label)); proof.append(d) }
      const honors = el('ul', 'honors')
      for (const h of about.honors) honors.append(el('li', '', h))
      side.append(el('p', 'label', 'by the numbers'), proof, el('p', 'label', 'honors'), honors)

      section.append(text, side)
      root.append(section)
      document.addEventListener('palettechange', draw)
      observer = new ResizeObserver(draw)
      observer.observe(hello)
      draw()
    },
    start() {},
    stop() {},
    destroy() {
      observer?.disconnect()
      document.removeEventListener('palettechange', draw)
      section.remove()
    },
  }
}
