import '@fontsource-variable/newsreader'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import { site } from '../src/content/site'
import { drawHand } from '../src/hand/draw'
import { LETTERS } from '../src/hand/poses'
import { landmarks } from '../src/hand/skeleton'

const add = (parent: HTMLElement, tag: string, text: string): void => {
  const node = document.createElement(tag)
  node.textContent = text
  parent.append(node)
}

// The card writes the name twice: once in type, once fingerspelled by the same hand the site uses.
// Six hands stay readable when a feed shrinks the card; the full first name makes them too small.
const word = (new URLSearchParams(location.search).get('spell') ?? 'HRISHI').toUpperCase().replace(/[^A-Z]/g, '')
const hands = [...word].map((ch) => landmarks(LETTERS[ch]))

document.getElementById('name')!.textContent = site.wordmark
const label = document.getElementById('label')!
add(label, 'b', '● ')
label.append('portfolio · CS at UIUC · my name, fingerspelled')
const letters = document.getElementById('letters')!
for (const ch of word) add(letters, 'span', ch.toLowerCase())
const work = document.getElementById('work')!
for (const w of site.work) add(work, 'i', w.name)
work.querySelectorAll('i').forEach((i) => { (i as HTMLElement).style.fontStyle = 'normal' })

// The site draws the hand with 1px lines and 3px joints; drawing small and scaling by K keeps those proportions.
const K = 1.7
const GAP = 30 / K
const canvas = document.getElementById('hands') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
ctx.scale(K, K)
const W = canvas.width / K, H = canvas.height / K
const box = (pts: [number, number][]) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}
// One scale for every hand: as large as the tallest pose and the full row's width allow. Each hand
// takes only the width it needs, so a sideways H does not shrink the fists beside it.
const boxes = hands.map(box)
const widths = boxes.map((b) => b.x1 - b.x0)
const scale = Math.min(
  (H - 8) / Math.max(...boxes.map((b) => b.y1 - b.y0)),
  (W - GAP * (hands.length - 1) - 8) / widths.reduce((a, b) => a + b, 0),
)
const row = widths.reduce((a, b) => a + b, 0) * scale + GAP * (hands.length - 1)
let left = (W - row) / 2
const spans = [...letters.children] as HTMLElement[]
hands.forEach((pts, i) => {
  const b = boxes[i]
  const mid = left + (widths[i] * scale) / 2
  // drawHand maps (x, y) to (cx + x * scale, cy - (y - 0.6) * scale); solve so every wrist-to-tip box
  // is centered on its slot and all hands share a baseline.
  const cx = mid - ((b.x0 + b.x1) / 2) * scale
  const cy = H - 4 + (b.y0 - 0.6) * scale
  drawHand(ctx, pts, { cx, cy, scale, pointer: null }, { ink: '#1b1a17', faint: 'rgba(27, 26, 23, 0.24)', paper: '#f4efe4' })
  spans[i].style.left = `${mid * K}px`
  left += widths[i] * scale + GAP
})
