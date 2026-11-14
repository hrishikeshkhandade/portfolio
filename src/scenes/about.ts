import type { Scene } from '../engine/scene'
import { about } from '../content/about'
import { site } from '../content/site'
import { el, projectSection } from './shell'

/** The closing scene: who I am and the proof behind it. Nothing here animates.
 * Contact links live in the page footer, so they are not repeated here. */
export function createAbout(): Scene {
  let section: HTMLElement

  return {
    mount(root) {
      section = projectSection('about')

      const text = el('div', 'p-text')
      const actions = el('p', 'about-actions')
      const resume = el('a', 'key primary plain', 'Read my resume')
      resume.href = '/resume.html'
      actions.append(resume)
      text.append(el('p', 'label', 'about'), el('p', 'p-line about-intro', about.intro), el('p', 'about-status', site.status), actions)

      const side = el('div', 'p-demo about-side')
      const proof = el('dl', 'proof')
      for (const p of about.proof) { const d = el('div'); d.append(el('dt', '', p.value), el('dd', '', p.label)); proof.append(d) }
      const honors = el('ul', 'honors')
      for (const h of about.honors) honors.append(el('li', '', h))
      side.append(el('p', 'label', 'by the numbers'), proof, el('p', 'label', 'honors'), honors)

      section.append(text, side)
      root.append(section)
    },
    start() {},
    stop() {},
    destroy() {
      section.remove()
    },
  }
}
