import '@fontsource-variable/newsreader'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import { site } from '../src/content/site'
import { drawHand } from '../src/hand/draw'
import { LETTERS, REST } from '../src/hand/poses'
import { landmarks } from '../src/hand/skeleton'

// ?pose=Y picks another fingerspelled letter; the default is L, which reads clearly as a hand.
const letter = new URLSearchParams(location.search).get('pose')?.toUpperCase() ?? ''
const pose = letter === 'REST' ? REST : LETTERS[letter] ?? LETTERS.L

document.getElementById('name')!.textContent = site.wordmark
const label = document.getElementById('label')!
const b = document.createElement('b')
b.textContent = '● '
label.append(b, 'portfolio · CS at UIUC')
const work = document.getElementById('work')!
site.work.forEach((w, i) => {
  if (i) { const dot = document.createElement('span'); dot.textContent = '  ·  '; work.append(dot) }
  work.append(w.name)
})

// The site draws the hand with 1px lines; drawing at 1/K size and scaling up keeps its proportions.
const K = 2.4
/** Canvas units per hand unit, before the K scale-up. */
const SCALE = 95
const canvas = document.getElementById('hand') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
ctx.scale(K, K)
drawHand(ctx, landmarks(pose), { cx: canvas.width / K / 2 + 0.28 * SCALE, cy: canvas.height / K / 2 + 0.3 * SCALE, scale: SCALE, pointer: null }, {
  ink: '#1b1a17', faint: 'rgba(27, 26, 23, 0.24)', paper: '#f4efe4',
})
