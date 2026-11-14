import { existsSync, readFileSync } from 'node:fs'
import { describe as group, expect, it } from 'vitest'
import { describe, headTags, SHARE_IMAGE } from '../src/content/meta'
import { site } from '../src/content/site'

group('head tags', () => {
  it('names every project in the description, so a new one cannot be forgotten', () => {
    for (const page of ['home', 'resume'] as const) {
      const text = describe(site, page)
      for (const w of site.work) expect(text, page).toContain(w.name)
      // Search engines cut descriptions at about 160 characters.
      expect(text.length, text).toBeLessThanOrEqual(160)
    }
  })
  it('uses absolute https addresses for the page and the preview image', () => {
    expect(site.url).toMatch(/^https:\/\/[a-z0-9.-]+$/)
    const tags = headTags(site, 'home')
    expect(tags).toContain(`<meta property="og:image" content="${site.url}/share.png" />`)
    expect(tags).toContain(`<link rel="canonical" href="${site.url}/" />`)
    expect(headTags(site, 'resume')).toContain(`<link rel="canonical" href="${site.url}/resume" />`)
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image" />')
  })
  it('escapes content so text cannot become markup', () => {
    const tags = headTags({ ...site, wordmark: '"><script>x</script> & co' }, 'home')
    expect(tags).not.toContain('<script>')
    expect(tags).toContain('&quot;&gt;&lt;script&gt;')
  })
  it('ships a preview image whose real size matches the tags', () => {
    const file = new URL(`../public${SHARE_IMAGE.path}`, import.meta.url)
    expect(existsSync(file)).toBe(true)
    const png = readFileSync(file)
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(SHARE_IMAGE.width)
    expect(png.readUInt32BE(20)).toBe(SHARE_IMAGE.height)
    // LinkedIn and others reject or skip very large images.
    expect(png.length).toBeLessThan(1_000_000)
  })
  it('both pages ask the build for these tags', () => {
    for (const page of ['index.html', 'resume.html']) {
      const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8')
      expect(html, page).toContain('<!--head-->')
      expect(html, page).not.toContain('name="description"')
    }
  })
})
