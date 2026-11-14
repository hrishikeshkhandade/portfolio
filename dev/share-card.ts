import '@fontsource-variable/newsreader'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import { site } from '../src/content/site'
import { drawHand, project, type HandView } from '../src/hand/draw'
import { landmarks, type Pose } from '../src/hand/skeleton'

const INK = '#1b1a17', FAINT = 'rgba(27, 26, 23, 0.24)', PAPER = '#f4efe4', SIGNAL = '#1f7a4d'

document.getElementById('name')!.textContent = site.wordmark
const label = document.getElementById('label')!
const dot = document.createElement('b')
dot.textContent = '● '
label.append(dot, 'portfolio · CS at UIUC')

// An open hand, not a letter: the card is about the work, and each finger holds one project.
const OPEN: Pose = { curl: [0, 0, 0, 0], spread: 1, thumb: { angle: -58, curl: 0 }, rot: 0 }
/** Fingertip landmarks, left to right as drawn: index, middle, ring, pinky. */
const TIPS = [8, 12, 16, 20]
const names = site.work.slice(0, TIPS.length).map((w) => w.name)

// The site draws the hand with 1px lines and 3px joints; drawing small and scaling by K keeps those proportions.
const K = 2.2
const art = document.getElementById('art')!
const canvas = document.getElementById('hand') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
ctx.scale(K, K)
const u = (px: number): number => px / K

// Card pixels. Labels sit in a column right of the hand, one level each, all above the fingertips.
const WRIST_Y = 574, HAND_X = 196, SCALE = 190
const LABEL_X = 392, TOP = 84, STEP = 44

const view: HandView = { cx: u(HAND_X), cy: u(WRIST_Y) - 0.6 * u(SCALE), scale: u(SCALE), pointer: null }
const pts = landmarks(OPEN)
const at = project(pts, view)

// Leader lines first, so the joints are drawn over their ends. The leftmost finger takes the top
// level: each line rises from its tip and turns right above every finger still to come, so none cross.
ctx.lineWidth = 1 / K * 1.5
ctx.strokeStyle = FAINT
names.forEach((name, i) => {
  const [x, y] = at[TIPS[i]]
  const level = u(TOP + i * STEP)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, level)
  ctx.lineTo(u(LABEL_X - 14), level)
  ctx.stroke()
  const tag = document.createElement('p')
  tag.className = 'tag'
  tag.textContent = name
  tag.style.left = `${LABEL_X}px`
  tag.style.top = `${TOP + i * STEP}px`
  art.append(tag)
})

drawHand(ctx, pts, view, { ink: INK, faint: FAINT, paper: PAPER })

// The fingertips that hold a project are filled with the site's one accent color.
ctx.fillStyle = SIGNAL
ctx.strokeStyle = INK
ctx.lineWidth = 1
names.forEach((_, i) => {
  const [x, y] = at[TIPS[i]]
  ctx.beginPath()
  ctx.arc(x, y, 3.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
})
