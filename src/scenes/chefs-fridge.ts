import type { Scene } from '../engine/scene'
import type { Fridge } from '../content/site'
import { el, projectSection, projectText, workById } from './shell'

const ITEM_MS = 260
const TYPE_MS = 14
/** Photos are shrunk in the browser before upload: enough for the model, small on a phone connection. */
const MAX_SIDE = 1024
const JPEG_QUALITY = 0.8

interface Live { ingredients: string[]; recipe: Fridge['recipe']; remaining: number }

/** Shrinks a photo and returns it as base64 JPEG (no data: prefix). */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * k)
  canvas.height = Math.round(bitmap.height * k)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1]
}

const PROBLEMS: Record<string, string> = {
  visitor_limit: 'You have used today\'s live tries. The sample fridges still work.',
  daily_limit: 'The live demo has reached its limit for today. The sample fridges still work.',
  no_food: 'No food found in that photo. Try one of a fridge, shelf or counter.',
  too_large: 'That photo is too large to send.',
  offline: 'The live demo runs on the deployed site. Showing a sample instead.',
  switched_off: 'The live demo is switched off right now. Showing a sample instead.',
}

/**
 * A scripted sample run of Chef's Fridge: pick a fridge, watch its ingredients get recognized one by
 * one, then a recipe written from only those ingredients. The recipes are fixed samples, not live AI.
 */
export function createChefsFridge(): Scene {
  const work = workById('chefs-fridge')
  const fridges = work.fridges ?? []
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  let section: HTMLElement, shelf: HTMLElement, recipe: HTMLElement, status: HTMLElement, upload: HTMLButtonElement, file: HTMLInputElement
  let tabs: HTMLButtonElement[] = []
  let timers: number[] = []
  let active = 0, running = false

  const clear = (): void => { timers.forEach((t) => clearTimeout(t)); timers = [] }
  const later = (fn: () => void, ms: number): void => { timers.push(window.setTimeout(fn, ms)) }

  function writeRecipe(fridge: Pick<Fridge, 'recipe'>, instant: boolean, done = 'recipe ready · sample run'): void {
    const { title, meta, steps } = fridge.recipe
    recipe.replaceChildren()
    const h = el('h3', 'r-title'), m = el('p', 'r-meta'), list = el('ol', 'r-steps')
    recipe.append(h, m, list)
    const lines: [HTMLElement, string][] = [[h, title], [m, meta], ...steps.map((s): [HTMLElement, string] => { const li = el('li'); list.append(li); return [li, s] })]
    if (instant) { lines.forEach(([node, text]) => { node.textContent = text }); status.textContent = done; return }
    let delay = 0
    for (const [node, text] of lines) {
      for (let i = 1; i <= text.length; i++) later(() => { node.textContent = text.slice(0, i) }, delay + i * TYPE_MS)
      delay += text.length * TYPE_MS + 140
    }
    later(() => { status.textContent = done }, delay)
  }

  function run(index: number, still = false): void {
    clear()
    active = index
    const fridge = fridges[index]
    tabs.forEach((t, i) => t.setAttribute('aria-pressed', String(i === index)))
    recipe.replaceChildren()
    shelf.replaceChildren()
    const chips = fridge.items.map((item) => { const c = el('li', 'chip', item); shelf.append(c); return c })
    const instant = still || reduce || !running
    if (instant) {
      chips.forEach((c) => c.classList.add('seen'))
      writeRecipe(fridge, true)
      return
    }
    status.textContent = 'looking at the photo…'
    chips.forEach((c, i) => later(() => {
      c.classList.add('seen')
      status.textContent = `found ${i + 1} of ${chips.length} ingredients`
    }, 350 + i * ITEM_MS))
    later(() => { status.textContent = 'writing a recipe from only these…'; writeRecipe(fridge, false) }, 350 + chips.length * ITEM_MS + 350)
  }

  /** Shows real output from the model the same way the samples are shown. */
  function showLive(result: Live): void {
    clear()
    tabs.forEach((t) => t.setAttribute('aria-pressed', 'false'))
    recipe.replaceChildren()
    shelf.replaceChildren()
    const chips = result.ingredients.map((item) => { const c = el('li', 'chip', item); shelf.append(c); return c })
    const left = `${result.remaining} live ${result.remaining === 1 ? 'try' : 'tries'} left today`
    const done = `real output from Gemini · ${left}`
    if (reduce) { chips.forEach((c) => c.classList.add('seen')); writeRecipe(result, true, done); return }
    chips.forEach((c, i) => later(() => c.classList.add('seen'), 120 + i * ITEM_MS))
    later(() => writeRecipe(result, false, done), 120 + chips.length * ITEM_MS + 250)
  }

  async function analyse(photo: File): Promise<void> {
    clear()
    upload.disabled = true
    status.textContent = 'shrinking the photo…'
    try {
      const image = await shrink(photo)
      status.textContent = 'Gemini is looking at your photo…'
      const response = await fetch('/api/fridge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image, mime: 'image/jpeg' }) })
      const isJson = response.headers.get('content-type')?.includes('application/json')
      // A static host or local preview has no function behind this address.
      if (!isJson || response.status === 404 || response.status === 405) { run(active, true); status.textContent = PROBLEMS.offline; return }
      // The function is deployed but has no model key yet: say so, rather than claim this is not the real site.
      if (response.status === 503) { run(active, true); status.textContent = PROBLEMS.switched_off; return }
      const data = await response.json() as Partial<Live> & { error?: string }
      if (data.error || !data.ingredients || !data.recipe) {
        status.textContent = PROBLEMS[data.error ?? ''] ?? 'That photo could not be read. Try another, or a sample fridge.'
        return
      }
      showLive({ ingredients: data.ingredients, recipe: data.recipe, remaining: data.remaining ?? 0 })
    } catch {
      status.textContent = 'That photo could not be read. Try another, or a sample fridge.'
    } finally {
      upload.disabled = false
      file.value = ''
    }
  }

  return {
    mount(root) {
      section = projectSection('chef')
      const demo = el('div', 'p-demo')

      const pick = el('div', 'tabs')
      pick.setAttribute('role', 'group')
      pick.setAttribute('aria-label', 'Sample fridges')
      tabs = fridges.map((f, i) => {
        const b = el('button', 'key tab', f.name)
        b.type = 'button'
        b.addEventListener('click', () => run(i))
        pick.append(b)
        return b
      })

      file = el('input')
      file.type = 'file'
      file.accept = 'image/*'
      file.hidden = true
      file.addEventListener('change', () => { const photo = file.files?.[0]; if (photo) void analyse(photo) })
      upload = el('button', 'key primary', 'Try with your own photo')
      upload.type = 'button'
      upload.addEventListener('click', () => file.click())
      const live = el('div', 'f-live')
      live.append(upload, file, el('span', 'f-note', 'Real AI, 3 tries a day. Your photo is sent to Google Gemini to be read; this site does not keep it.'))

      const fridge = el('div', 'fridge')
      shelf = el('ul', 'shelf')
      fridge.append(shelf)

      status = el('p', 'f-status')
      status.setAttribute('aria-live', 'polite')
      recipe = el('div', 'recipe')
      demo.append(live, el('p', 'label', 'or try a sample fridge'), pick, el('p', 'label f-label', 'what the model sees in the photo'), fridge, status, recipe,
        el('p', 'a-pipe', 'photo → ingredients recognized → recipe from only those · samples are illustrative; your own photo runs real AI'))

      section.append(projectText(work), demo)
      root.append(section)
      run(0)
    },
    start() { if (!running) { running = true; run(active) } },
    stop() { running = false; clear() },
    destroy() { clear(); section.remove() },
  }
}
