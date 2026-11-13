import type { Scene } from '../engine/scene'
import type { Fridge } from '../content/site'
import { el, projectSection, projectText, workById } from './shell'

const ITEM_MS = 260
const TYPE_MS = 14

/**
 * A scripted sample run of Chef's Fridge: pick a fridge, watch its ingredients get recognized one by
 * one, then a recipe written from only those ingredients. The recipes are fixed samples, not live AI.
 */
export function createChefsFridge(): Scene {
  const work = workById('chefs-fridge')
  const fridges = work.fridges ?? []
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  let section: HTMLElement, shelf: HTMLElement, recipe: HTMLElement, status: HTMLElement
  let tabs: HTMLButtonElement[] = []
  let timers: number[] = []
  let active = 0, running = false

  const clear = (): void => { timers.forEach((t) => clearTimeout(t)); timers = [] }
  const later = (fn: () => void, ms: number): void => { timers.push(window.setTimeout(fn, ms)) }

  function writeRecipe(fridge: Fridge, instant: boolean): void {
    const { title, meta, steps } = fridge.recipe
    recipe.replaceChildren()
    const h = el('h3', 'r-title'), m = el('p', 'r-meta'), list = el('ol', 'r-steps')
    recipe.append(h, m, list)
    const lines: [HTMLElement, string][] = [[h, title], [m, meta], ...steps.map((s): [HTMLElement, string] => { const li = el('li'); list.append(li); return [li, s] })]
    if (instant) { lines.forEach(([node, text]) => { node.textContent = text }); status.textContent = 'recipe ready · sample run'; return }
    let delay = 0
    for (const [node, text] of lines) {
      for (let i = 1; i <= text.length; i++) later(() => { node.textContent = text.slice(0, i) }, delay + i * TYPE_MS)
      delay += text.length * TYPE_MS + 140
    }
    later(() => { status.textContent = 'recipe ready · sample run' }, delay)
  }

  function run(index: number): void {
    clear()
    active = index
    const fridge = fridges[index]
    tabs.forEach((t, i) => t.setAttribute('aria-pressed', String(i === index)))
    recipe.replaceChildren()
    shelf.replaceChildren()
    const chips = fridge.items.map((item) => { const c = el('li', 'chip', item); shelf.append(c); return c })
    const instant = reduce || !running
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

      const fridge = el('div', 'fridge')
      shelf = el('ul', 'shelf')
      fridge.append(shelf)

      status = el('p', 'f-status')
      status.setAttribute('aria-live', 'polite')
      recipe = el('div', 'recipe')
      demo.append(el('p', 'label', 'try a sample fridge'), pick, el('p', 'label f-label', 'what the model sees in the photo'), fridge, status, recipe,
        el('p', 'a-pipe', 'photo → ingredients recognized → recipe from only those · illustrative sample, not live AI'))

      section.append(projectText(work), demo)
      root.append(section)
      run(0)
    },
    start() { if (!running) { running = true; run(active) } },
    stop() { running = false; clear() },
    destroy() { clear(); section.remove() },
  }
}
