import { describe, expect, it } from 'vitest'
import { renderFallback, renderResume } from '../src/resume/render'
import { site } from '../src/content/site'
import { about } from '../src/content/about'

const html = renderResume(site, about)

describe('resume page', () => {
  it('contains every section and every entry from the content files', () => {
    for (const heading of ['Education', 'Experience', 'Projects', 'Honors', 'Leadership', 'Skills']) expect(html).toContain(`<h2>${heading}</h2>`)
    for (const e of about.education) expect(html).toContain(e.school)
    for (const e of about.experience) expect(html).toContain(e.org)
    for (const p of about.projects) expect(html).toContain(p.name)
    expect(html).toContain(site.wordmark)
  })
  it('never contains a phone number or email address', () => {
    for (const text of [html, renderFallback(site, about), JSON.stringify(about)]) {
      expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
      expect(text).not.toMatch(/mailto:|tel:/)
      expect(text).not.toMatch(/\(\d{3}\)\s?\d{3}|\+\d[\d\s-]{8,}/)
    }
  })
  it('escapes content so text cannot become markup', () => {
    const out = renderResume({ ...site, wordmark: '<img src=x onerror=alert(1)> & "q"' }, about)
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;')
  })
  it('links to live projects and profiles', () => {
    expect(html).toContain('https://super-scholar.super-scholar.workers.dev')
    expect(html).toContain('https://apps.apple.com/')
    expect(html).toContain('github.com/hrishikeshkhandade')
  })
  it('gives a no-script fallback with every project and the resume link', () => {
    const fb = renderFallback(site, about)
    for (const w of site.work) expect(fb).toContain(w.name.replace(/'/g, "'"))
    expect(fb).toContain('href="/resume.html"')
  })
  it('has six proof points and a short intro for the About scene', () => {
    expect(about.proof).toHaveLength(6)
    expect(about.intro.length).toBeGreaterThan(80)
    expect(about.intro.length).toBeLessThan(420)
  })
})
