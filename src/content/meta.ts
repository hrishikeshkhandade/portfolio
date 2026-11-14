import type { SiteContent } from './site'

const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** "A, B and C" */
const andList = (names: string[]): string =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

export type Page = 'home' | 'resume'

export const SHARE_IMAGE = { path: '/share.png', width: 1200, height: 630 }

/** One sentence for search results and link previews. Built from the project list so it cannot go stale. */
export function describe(site: SiteContent, page: Page): string {
  const names = andList(site.work.map((w) => w.name))
  return page === 'resume'
    ? `Resume of ${site.wordmark}, computer science at UIUC. Work: ${names}.`
    : `${site.wordmark}, computer science at UIUC. Playable demos of ${names}.`
}

/**
 * The description, canonical address and link preview tags for a page's <head>. Preview images must
 * be absolute addresses, so everything hangs off site.url; change it there when the domain changes.
 */
export function headTags(site: SiteContent, page: Page): string {
  const base = site.url.replace(/\/+$/, '')
  const url = page === 'resume' ? `${base}/resume` : `${base}/`
  const title = page === 'resume' ? `Resume · ${site.wordmark}` : site.wordmark
  const text = describe(site, page)
  const image = `${base}${SHARE_IMAGE.path}`
  const alt = `${site.wordmark}: portfolio. Line-drawn hands fingerspell H, R, I, S, H, I above the projects ${andList(site.work.map((w) => w.name))}`
  const meta = (attr: 'name' | 'property', key: string, value: string | number): string =>
    `<meta ${attr}="${key}" content="${esc(String(value))}" />`
  return [
    meta('name', 'description', text),
    `<link rel="canonical" href="${esc(url)}" />`,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', site.wordmark),
    meta('property', 'og:title', title),
    meta('property', 'og:description', text),
    meta('property', 'og:url', url),
    meta('property', 'og:image', image),
    meta('property', 'og:image:type', 'image/png'),
    meta('property', 'og:image:width', SHARE_IMAGE.width),
    meta('property', 'og:image:height', SHARE_IMAGE.height),
    meta('property', 'og:image:alt', alt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', text),
    meta('name', 'twitter:image', image),
  ].join('\n    ')
}
