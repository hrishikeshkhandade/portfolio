import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import { parse } from 'yaml'
import type { About } from './src/content/about'
import type { SiteContent } from './src/content/site'
import { headTags } from './src/content/meta'
import { renderFallback, renderResume } from './src/resume/render'

function yamlPlugin(): Plugin {
  return {
    name: 'yaml',
    transform(code, id) {
      if (!/\.ya?ml$/.test(id)) return null
      return { code: `export default ${JSON.stringify(parse(code))}`, map: null }
    },
  }
}

/** Writes the resume, the no-script fallback and the head tags into the HTML at build time, from the content files. */
function staticContent(): Plugin {
  const load = <T>(file: string): T => parse(readFileSync(new URL(`./content/${file}`, import.meta.url), 'utf8')) as T
  return {
    name: 'static-content',
    transformIndexHtml(html, ctx) {
      const site = load<SiteContent>('site.yaml'), about = load<About>('about.yaml')
      const page = ctx.path.includes('resume') ? 'resume' : 'home'
      return html.replace('<!--head-->', () => headTags(site, page)).replace('<!--resume-->', () => renderResume(site, about)).replace('<!--fallback-->', () => renderFallback(site, about))
    },
  }
}

export default defineConfig({
  plugins: [yamlPlugin(), staticContent()],
  build: { rollupOptions: { input: { main: 'index.html', resume: 'resume.html' } } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
