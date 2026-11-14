import { handleFridge, type FridgeEnv } from './fridge'

interface Env extends FridgeEnv {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/fridge') return handleFridge(request, env)
    if (pathname.startsWith('/api/')) return new Response('Not found', { status: 404 })
    return env.ASSETS.fetch(request)
  },
}
