import type { About } from '../content/about'
import type { SiteContent } from '../content/site'

const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const list = (items: string[]): string => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
const entry = (title: string, sub: string, when: string, points: string[]): string =>
  `<article><header><h3>${esc(title)}</h3><p class="when">${esc(when)}</p></header><p class="sub">${esc(sub)}</p>${list(points)}</article>`

/** The resume as plain HTML, built from the same content files as the site. No scripts needed to read it. */
export function renderResume(site: SiteContent, about: About): string {
  const links = site.links.map((l) => `<a href="${esc(l.url)}">${esc(l.url.replace(/^https:\/\/(www\.)?/, ''))}</a>`).join(' · ')
  const liveLinks = (name: string): string => {
    const work = site.work.find((w) => w.name === name)
    return work ? ` <span class="links">${work.links.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join(' · ')}</span>` : ''
  }
  return [
    `<header class="head"><h1>${esc(site.wordmark)}</h1><p>${esc(about.location)} · ${links}</p><p class="status">${esc(site.status)}</p></header>`,
    `<section><h2>Education</h2>${about.education.map((e) => entry(e.school, e.detail, e.when, e.notes)).join('')}</section>`,
    `<section><h2>Experience</h2>${about.experience.map((e) => entry(e.org, e.role, e.when, e.points)).join('')}</section>`,
    `<section><h2>Projects</h2>${about.projects.map((p) => entry(p.name, p.context, p.when, p.points).replace('</h3>', `</h3>${liveLinks(p.name)}`)).join('')}`,
    `<article><header><h3>ASLive and Chef's Fridge</h3></header><p class="sub">See Experience.${liveLinks('ASLive')}${liveLinks("Chef's Fridge")}</p></article></section>`,
    `<section><h2>Honors</h2>${list(about.honors)}</section>`,
    `<section><h2>Leadership</h2>${list(about.leadership)}</section>`,
    `<section><h2>Skills</h2><dl>${about.skills.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.items)}</dd></div>`).join('')}<div><dt>Certifications</dt><dd>${esc(about.certifications)}</dd></div></dl></section>`,
  ].join('\n')
}

/** What a visitor sees on the main page if scripts do not run: who, what, and where to go. */
export function renderFallback(site: SiteContent, about: About): string {
  const work = site.work.map((w) => `<li><strong>${esc(w.name)}</strong>: ${esc(w.line)}. ${w.links.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join(', ')}</li>`).join('')
  const links = site.links.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join(' · ')
  return `<div class="fallback"><p>${esc(about.intro)}</p><ul>${work}</ul><p><a href="/resume.html">Resume</a> · ${links}</p></div>`
}
