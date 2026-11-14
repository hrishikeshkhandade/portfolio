import '../styles/project.css'
import { how } from '../content/how'
import { site, type Work } from '../content/site'

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

export const workById = (id: string): Work => {
  const work = site.work.find((w) => w.id === id)
  if (!work) throw new Error(`No project with id ${id} in content/site.yaml`)
  return work
}

export function externalLink(label: string, url: string, cls = ''): HTMLAnchorElement {
  const a = el('a', cls, `${label} ↗`)
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  a.setAttribute('aria-label', `${label} (opens in a new tab)`)
  return a
}

/** The text column every project scene shares: label, title, summary, numbers, links, note. */
export function projectText(work: Work): HTMLElement {
  const text = el('div', 'p-text')
  text.append(el('p', 'label', 'project'), el('h2', 'p-title', work.name), el('p', 'p-line', work.summary ?? work.line))
  if (work.stats?.length) {
    const stats = el('dl', 'p-stats')
    for (const s of work.stats) {
      const d = el('div')
      d.append(el('dt', '', s.value), el('dd', '', s.label))
      stats.append(d)
    }
    text.append(stats)
  }
  const links = el('p', 'p-links')
  for (const link of work.links) links.append(externalLink(link.label, link.url))
  // Projects with a write-up link to it last, so scenes that restyle their first link are unaffected.
  if (how.some((entry) => entry.id === work.id)) {
    const a = el('a', '', 'How it works')
    a.href = `/how.html#${work.id}`
    links.append(a)
  }
  text.append(links)
  if (work.note) text.append(el('p', 'p-note', work.note))
  return text
}

/** A project scene's outer section, scrollable on small screens. */
export function projectSection(cls: string): HTMLElement {
  const section = el('section', `project ${cls}`)
  section.dataset.scroll = ''
  return section
}
