import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import { parse } from 'yaml'

function yamlPlugin(): Plugin {
  return {
    name: 'yaml',
    transform(code, id) {
      if (!/\.ya?ml$/.test(id)) return null
      return { code: `export default ${JSON.stringify(parse(code))}`, map: null }
    },
  }
}

export default defineConfig({
  plugins: [yamlPlugin()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
