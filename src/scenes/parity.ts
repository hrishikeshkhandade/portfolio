import type { Scene } from '../engine/scene'
import { exact, explainEven, listAll, ratioRule, type Counts, type Query } from '../parity/count'
import { el, projectSection, projectText, workById } from './shell'

const MAX_LENGTH = 6
const EXAMPLES = 8
const fmt = (x: number): string => x.toLocaleString('en-US')

/**
 * The parity formula, live: pick digits, a length and whether digits may repeat. The scene shows the
 * first version of the formula, the exact one, and a count made by listing every number, side by side.
 */
export function createParity(): Scene {
  const work = workById('parity')
  // Starts on the first worked example from the original paper.
  const chosen = new Set([1, 2, 3, 4])
  let length = 2, repeat = false

  let section: HTMLElement, lengthOut: HTMLElement, less: HTMLButtonElement, more: HTMLButtonElement, repeatBtn: HTMLButtonElement
  let verdict: HTMLElement, working: HTMLElement, samples: HTMLElement
  let digitKeys: HTMLButtonElement[] = []
  const cells: Record<'simple' | 'exact' | 'listed', HTMLElement[]> = { simple: [], exact: [], listed: [] }

  function fill(row: HTMLElement[], counts: Counts, truth: Counts): void {
    const keys = ['even', 'odd', 'total'] as const
    keys.forEach((k, i) => {
      const wrong = counts[k] !== truth[k]
      row[i].textContent = fmt(counts[k])
      row[i].classList.toggle('off', wrong)
      row[i].setAttribute('aria-label', wrong ? `${fmt(counts[k])}, which is wrong` : fmt(counts[k]))
    })
  }

  function render(): void {
    const q: Query = { digits: [...chosen], length, repeat }
    const listed = listAll(q, EXAMPLES)
    const simple = ratioRule(q)
    fill(cells.simple, simple, listed)
    fill(cells.exact, exact(q), listed)
    fill(cells.listed, listed, listed)

    digitKeys.forEach((b, d) => b.setAttribute('aria-pressed', String(chosen.has(d))))
    lengthOut.textContent = String(length)
    less.disabled = length <= 1
    more.disabled = length >= MAX_LENGTH
    repeatBtn.setAttribute('aria-pressed', String(repeat))
    repeatBtn.textContent = repeat ? 'digits may repeat' : 'no repeated digits'

    const gap = simple.total - listed.total
    if (chosen.size === 0) verdict.textContent = 'Pick some digits.'
    else if (gap === 0) verdict.textContent = chosen.has(0)
      ? 'All three agree.'
      : 'All three agree. With no zero, every digit is equally likely to land last, so the simple ratio is exact. Add 0 to break it.'
    else verdict.textContent = `Zero cannot lead a number, so the simple rule counts ${fmt(gap)} that do not exist. The exact formula still matches the list.`

    working.replaceChildren(...explainEven(q).map((line) => el('li', '', line)))
    const show = (label: string, xs: number[], count: number): string =>
      count === 0 ? `${label}: none` : `${label}: ${xs.join(', ')}${count > xs.length ? ', …' : ''}`
    samples.textContent = listed.total === 0 ? '' : `${show('even', listed.evens, listed.even)}  ·  ${show('odd', listed.odds, listed.odd)}`
  }

  return {
    mount(root) {
      section = projectSection('parity')
      const demo = el('div', 'p-demo')

      const pick = el('div', 'pz-pick')
      pick.setAttribute('role', 'group')
      pick.setAttribute('aria-label', 'Digits in the set')
      digitKeys = [...Array(10).keys()].map((d) => {
        const b = el('button', 'key tab pz-digit', String(d))
        b.type = 'button'
        b.addEventListener('click', () => { if (chosen.has(d)) chosen.delete(d); else chosen.add(d); render() })
        pick.append(b)
        return b
      })

      const ctl = el('div', 'pz-ctl')
      const stepper = el('span', 'pz-step')
      less = el('button', 'key', '−')
      more = el('button', 'key', '+')
      less.type = more.type = 'button'
      less.setAttribute('aria-label', 'Shorter numbers')
      more.setAttribute('aria-label', 'Longer numbers')
      less.addEventListener('click', () => { length = Math.max(1, length - 1); render() })
      more.addEventListener('click', () => { length = Math.min(MAX_LENGTH, length + 1); render() })
      lengthOut = el('output', 'pz-len')
      lengthOut.setAttribute('aria-live', 'polite')
      stepper.append(less, lengthOut, el('span', '', 'digits long'), more)
      repeatBtn = el('button', 'key tab')
      repeatBtn.type = 'button'
      repeatBtn.addEventListener('click', () => { repeat = !repeat; render() })
      ctl.append(stepper, repeatBtn)

      const table = el('table', 'pz-table')
      const head = el('tr')
      head.append(el('td'), ...['even', 'odd', 'total'].map((h) => { const th = el('th', '', h); th.scope = 'col'; return th }))
      const thead = el('thead')
      thead.append(head)
      const body = el('tbody')
      const rows: [keyof typeof cells, string][] = [['simple', 'simple ratio rule'], ['exact', 'exact formula'], ['listed', 'listed one by one']]
      for (const [key, label] of rows) {
        const tr = el('tr')
        const th = el('th', '', label)
        th.scope = 'row'
        cells[key] = [el('td'), el('td'), el('td')]
        tr.append(th, ...cells[key])
        body.append(tr)
      }
      table.append(thead, body)

      verdict = el('p', 'f-status pz-verdict')
      verdict.setAttribute('aria-live', 'polite')
      working = el('ol', 'pz-work')
      samples = el('p', 'a-pipe pz-samples')

      demo.append(el('p', 'label', 'digits'), pick, ctl, table, verdict, working, samples)
      section.append(projectText(work), demo)
      root.append(section)
      render()
    },
    start() {},
    stop() {},
    destroy() { section.remove() },
  }
}
