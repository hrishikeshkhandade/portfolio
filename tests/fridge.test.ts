import { describe, expect, it } from 'vitest'
import { MAX_BODY, extractText, handleFridge, parseRecipe, type FridgeEnv, type KV } from '../worker/fridge'

const IMAGE = 'A'.repeat(400)
const GOOD = { ingredients: ['Eggs', 'spinach', 'eggs', ''], title: 'Green omelette', meta: '10 min · vegetarian', steps: ['Whisk eggs.', 'Wilt spinach.', 'Fold together.'] }
const NOW = new Date('2026-11-13T12:00:00Z')

function kv(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, get: async (k) => data.get(k) ?? null, put: async (k, v) => { data.set(k, v) } }
}
const env = (over: Partial<FridgeEnv> = {}): FridgeEnv => ({ GEMINI_API_KEY: 'test-key', LIMITS: kv(), DAILY_PER_VISITOR: '3', DAILY_TOTAL: '5', ...over })
const post = (body: unknown, headers: Record<string, string> = {}): Request =>
  new Request('https://site.example/api/fridge', {
    method: 'POST',
    headers: { origin: 'https://site.example', 'cf-connecting-ip': '203.0.113.7', 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
const model = (payload: unknown, status = 200) => {
  const calls: { url: string; init: RequestInit }[] = []
  const fetcher = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify(payload), { status }) }) as unknown as typeof fetch
  return { fetcher, calls }
}
const reply = (data: unknown) => ({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(data) }] }] })

describe('fridge function', () => {
  it('returns cleaned ingredients and a recipe, and sends the right request to the model', async () => {
    const m = model(reply(GOOD))
    const res = await handleFridge(post({ image: IMAGE, mime: 'image/jpeg' }), env(), m.fetcher, NOW)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ingredients: ['eggs', 'spinach'], recipe: { title: 'Green omelette', meta: '10 min · vegetarian', steps: GOOD.steps }, remaining: 2 })
    expect(m.calls).toHaveLength(1)
    expect(m.calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions')
    const sent = JSON.parse(m.calls[0].init.body as string)
    expect(sent.model).toBe('gemini-3.5-flash-lite')
    expect(sent.store).toBe(false)
    expect(sent.input[1]).toEqual({ type: 'image', data: IMAGE, mime_type: 'image/jpeg' })
    expect(sent.response_format.mime_type).toBe('application/json')
    expect((m.calls[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key')
  })
  it('stops a visitor after their daily tries without calling the model again', async () => {
    const e = env(), m = model(reply(GOOD))
    for (let i = 0; i < 3; i++) expect((await handleFridge(post({ image: IMAGE, mime: 'image/jpeg' }), e, m.fetcher, NOW)).status).toBe(200)
    const blocked = await handleFridge(post({ image: IMAGE, mime: 'image/jpeg' }), e, m.fetcher, NOW)
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toEqual({ error: 'visitor_limit' })
    expect(m.calls).toHaveLength(3)
  })
  it('stops everyone once the daily total is used, and resets the next day', async () => {
    const e = env(), m = model(reply(GOOD))
    for (let i = 0; i < 5; i++) await handleFridge(post({ image: IMAGE, mime: 'image/jpeg' }, { 'cf-connecting-ip': `198.51.100.${i}` }), e, m.fetcher, NOW)
    const blocked = await handleFridge(post({ image: IMAGE, mime: 'image/jpeg' }, { 'cf-connecting-ip': '198.51.100.99' }), e, m.fetcher, NOW)
    expect(await blocked.json()).toEqual({ error: 'daily_limit' })
    const tomorrow = await handleFridge(post({ image: IMAGE, mime: 'image/jpeg' }, { 'cf-connecting-ip': '198.51.100.99' }), e, m.fetcher, new Date('2026-11-14T00:01:00Z'))
    expect(tomorrow.status).toBe(200)
  })
  it('counts a try even when the model fails, so failures cannot bypass the cap', async () => {
    const e = env(), bad = model({ error: { code: 'api_error' } }, 500)
    for (let i = 0; i < 3; i++) expect((await handleFridge(post({ image: IMAGE, mime: 'image/jpeg' }), e, bad.fetcher, NOW)).status).toBe(502)
    expect((await handleFridge(post({ image: IMAGE, mime: 'image/jpeg' }), e, bad.fetcher, NOW)).status).toBe(429)
  })
  it('never stores the visitor address', async () => {
    const e = env(), m = model(reply(GOOD))
    await handleFridge(post({ image: IMAGE, mime: 'image/jpeg' }), e, m.fetcher, NOW)
    const keys = [...(e.LIMITS as ReturnType<typeof kv>).data.keys()].join(' ')
    expect(keys).not.toContain('203.0.113.7')
  })
  it('rejects wrong method, other sites, missing setup, oversized and malformed requests before any model call', async () => {
    const m = model(reply(GOOD))
    const cases: [Request, FridgeEnv, number][] = [
      [new Request('https://site.example/api/fridge', { headers: { origin: 'https://site.example' } }), env(), 405],
      [post({ image: IMAGE, mime: 'image/jpeg' }, { origin: 'https://evil.example' }), env(), 403],
      [post({ image: IMAGE, mime: 'image/jpeg' }), env({ GEMINI_API_KEY: undefined }), 503],
      [post({ image: IMAGE, mime: 'image/jpeg' }), env({ LIMITS: undefined }), 503],
      [post('x'.repeat(MAX_BODY + 1)), env(), 413],
      [post('not json'), env(), 400],
      [post({ image: 'not base64 !!', mime: 'image/jpeg' }), env(), 400],
      [post({ image: IMAGE, mime: 'image/svg+xml' }), env(), 400],
      [post({ mime: 'image/jpeg' }), env(), 400],
    ]
    for (const [req, e, status] of cases) expect((await handleFridge(req, e, m.fetcher, NOW)).status).toBe(status)
    expect(m.calls).toHaveLength(0)
  })
  it('reports no food and unusable model output distinctly', async () => {
    const none = await handleFridge(post({ image: IMAGE, mime: 'image/jpeg' }), env(), model(reply({ ingredients: [], title: '', meta: '', steps: [] })).fetcher, NOW)
    expect(await none.json()).toEqual({ error: 'no_food', remaining: 2 })
    const junk = await handleFridge(post({ image: IMAGE, mime: 'image/jpeg' }), env(), model(reply('hello')).fetcher, NOW)
    expect(junk.status).toBe(502)
  })
})

describe('reading the model reply', () => {
  it('finds text in each documented layout', () => {
    expect(extractText({ output_text: 'a' })).toBe('a')
    expect(extractText({ steps: [{ type: 'user_input', content: [{ type: 'text', text: 'no' }] }, { type: 'model_output', content: [{ type: 'text', text: 'b' }, { type: 'text', text: 'c' }] }] })).toBe('bc')
    expect(extractText({ outputs: [{ type: 'text', text: 'd' }] })).toBe('d')
    expect(extractText(null)).toBe('')
    expect(extractText({ steps: 'nope' })).toBe('')
  })
  it('bounds and cleans whatever the model returns', () => {
    const wild = parseRecipe(JSON.stringify({
      ingredients: Array.from({ length: 30 }, (_, i) => `Item ${i}\n<script>`), title: 'T'.repeat(500), meta: 5, steps: Array.from({ length: 20 }, () => 's'.repeat(999)),
    }))!
    expect(wild.ingredients).toHaveLength(10)
    expect(wild.ingredients[0]).toBe('item 0 <script>')
    expect(wild.recipe.title).toHaveLength(90)
    expect(wild.recipe.meta).toBe('')
    expect(wild.recipe.steps).toHaveLength(5)
    expect(wild.recipe.steps[0]).toHaveLength(220)
    expect(parseRecipe('```json\n{"ingredients":["egg"],"title":"x","meta":"y","steps":["z"]}\n```')?.ingredients).toEqual(['egg'])
    expect(parseRecipe('{"ingredients":"egg"}')).toBeNull()
    expect(parseRecipe('')).toBeNull()
  })
})
