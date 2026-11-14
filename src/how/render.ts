import type { HowEntry, HowSection } from '../content/how'
import type { SiteContent } from '../content/site'

const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const pair = (items: { head: string; body: string }[], tag: 'ol' | 'ul', cls: string): string =>
  `<${tag} class="${cls}">${items.map((i) => `<li><h4>${esc(i.head)}</h4><p>${esc(i.body)}</p></li>`).join('')}</${tag}>`

function section(s: HowSection): string {
  const body = s.steps ? pair(s.steps, 'ol', 'steps')
    : s.points ? pair(s.points, 'ul', 'points')
    : s.list ? `<ul class="plain">${s.list.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
    : (s.text ?? []).map((p) => `<p>${esc(p)}</p>`).join('')
  return `<section><h3>${esc(s.title)}</h3>${body}</section>`
}

/**
 * The "how it works" page as plain HTML, built from content/how.yaml. No scripts needed to read it.
 * Entries follow the order of the projects on the site; an entry for an unknown project is an error.
 */
export function renderHow(site: SiteContent, how: HowEntry[]): string {
  const entries = how.map((entry) => {
    const work = site.work.find((w) => w.id === entry.id)
    if (!work) throw new Error(`content/how.yaml: no project with id ${entry.id} in content/site.yaml`)
    return { entry, work, order: site.work.indexOf(work) }
  }).sort((a, b) => a.order - b.order)

  const toc = entries.length > 1
    ? `<nav class="toc" aria-label="Projects">${entries.map(({ work }) => `<a href="#${esc(work.id!)}">${esc(work.name)}</a>`).join('')}</nav>`
    : ''
  const articles = entries.map(({ entry, work }) => [
    `<article id="${esc(work.id!)}">`,
    `<header><p class="kicker">${esc(work.line)}</p><h2>${esc(work.name)}</h2><p class="lede">${esc(entry.lede)}</p>`,
    `<p class="try"><a href="/#${esc(work.id!)}">Try the demo</a></p></header>`,
    entry.sections.map(section).join(''),
    `</article>`,
  ].join('')).join('\n')
  return `<header class="head"><h1>How it works</h1><p>${esc(site.wordmark)} · what each project does under the surface, and where it stops.</p></header>${toc}\n${articles}`
}
