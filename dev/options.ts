// Dev-only comparison sheet of hand drawing styles. Not part of the site build.
import { landmarks as flat } from '../src/hand/skeleton'
import { LETTERS as FLAT } from '../src/hand/poses'
import { drawHand as drawCurrent } from '../src/hand/draw'
import { landmarks, shell, type P3 } from './hand3d/skeleton'
import { LETTERS } from './hand3d/poses'

const INK = '#1b1a17', FAINT = 'rgba(27,26,23,0.26)', PAPER = '#f4efe4'
const RAD = Math.PI / 180
type S = [number, number, number]

function project(pts: P3[], cx: number, cy: number, scale: number): S[] {
  const yaw = -9 * RAD, pitch = 5 * RAD
  return pts.map(([x, y0, z]): S => {
    const y = y0 - 0.55
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw), z1 = -x * Math.sin(yaw) + z * Math.cos(yaw)
    const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch), z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch)
    const k = 7 / (7 - z2)
    return [cx + x1 * k * scale, cy - y2 * k * scale, z2]
  })
}

const line = (ctx: CanvasRenderingContext2D, pts: S[], close = false) => {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  if (close) ctx.closePath()
}
const dot = (ctx: CanvasRenderingContext2D, [x, y]: S, r: number, fill: string, stroke?: string) => {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill()
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke() }
}
const digit = (p: S[], d: number): S[] => [p[1 + d * 4], p[2 + d * 4], p[3 + d * 4], p[4 + d * 4]]
const byDepth = (p: S[]) => [0, 1, 2, 3, 4].map((d) => digit(p, d)).sort((a, b) => (a[2][2] + a[3][2]) - (b[2][2] + b[3][2]))
const wrist = (ctx: CanvasRenderingContext2D, arm: S[], color: string, w: number) => {
  ctx.strokeStyle = color; ctx.lineWidth = w
  for (const [a, b] of [[arm[0], arm[3]], [arm[1], arm[2]]]) { line(ctx, [a, b]); ctx.stroke() }
}

type Style = { name: string; note: string; draw: (ctx: CanvasRenderingContext2D, ch: string, cx: number, cy: number, s: number) => void }

const styles: Style[] = [
  {
    name: 'A  Current', note: 'what is live now',
    draw: (ctx, ch, cx, cy, s) => drawCurrent(ctx, flat(FLAT[ch]), { cx, cy, scale: s, pointer: null }, { ink: INK, faint: FAINT, paper: PAPER }),
  },
  {
    name: 'B  True skeleton', note: 'correct proportions, palm loop, no V',
    draw: (ctx, ch, cx, cy, s) => {
      const p = project(landmarks(LETTERS[ch]), cx, cy, s), sh = shell(LETTERS[ch])
      ctx.lineWidth = 1; ctx.strokeStyle = FAINT
      line(ctx, project(sh.palm, cx, cy, s), true); ctx.stroke()
      for (const d of byDepth(p)) {
        ctx.strokeStyle = PAPER; ctx.lineWidth = 5; line(ctx, d); ctx.stroke()
        ctx.strokeStyle = INK; ctx.lineWidth = 1.2; line(ctx, d); ctx.stroke()
        ctx.lineWidth = 1.1
        for (const q of d) dot(ctx, q, 2.4, PAPER, INK)
      }
    },
  },
  {
    name: 'C  Line drawing', note: 'no joints, fingertips only',
    draw: (ctx, ch, cx, cy, s) => {
      const p = project(landmarks(LETTERS[ch]), cx, cy, s), sh = shell(LETTERS[ch])
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4
      line(ctx, project(sh.palm, cx, cy, s), true); ctx.stroke()
      wrist(ctx, project(sh.arm, cx, cy, s), INK, 1.4)
      for (const d of byDepth(p)) {
        ctx.strokeStyle = PAPER; ctx.lineWidth = 6; line(ctx, d); ctx.stroke()
        ctx.strokeStyle = INK; ctx.lineWidth = 1.4; line(ctx, d); ctx.stroke()
        dot(ctx, d[3], 2.6, INK)
      }
    },
  },
  {
    name: 'D  Contour', note: 'one clean outline of the whole hand',
    draw: (ctx, ch, cx, cy, s) => {
      const p = project(landmarks(LETTERS[ch]), cx, cy, s), sh = shell(LETTERS[ch])
      const palm = project(sh.palm, cx, cy, s), arm = project(sh.arm, cx, cy, s)
      const girth = [0.24, 0.19, 0.2, 0.185, 0.16]
      const pass = (color: string, extra: number) => {
        ctx.strokeStyle = color; ctx.fillStyle = color
        ctx.lineWidth = s * 0.05 + extra; line(ctx, palm, true); ctx.fill(); ctx.stroke()
        ctx.lineWidth = s * 0.05 + extra; line(ctx, [arm[0], arm[1], arm[2], arm[3]], true); ctx.fill(); ctx.stroke()
        for (let d = 0; d < 5; d++) { ctx.lineWidth = s * girth[d] + extra; line(ctx, digit(p, d)); ctx.stroke() }
      }
      pass(INK, 2.6)
      pass(PAPER, 0)
      // open the forearm at the bottom so it runs off rather than ending in a bar
      ctx.strokeStyle = PAPER; ctx.lineWidth = 4; line(ctx, [arm[2], arm[3]]); ctx.stroke()
    },
  },
  {
    name: 'E  Points', note: 'landmarks only, fingertips solid',
    draw: (ctx, ch, cx, cy, s) => {
      const p = project(landmarks(LETTERS[ch]), cx, cy, s)
      ctx.strokeStyle = 'rgba(27,26,23,0.16)'; ctx.lineWidth = 1
      for (let d = 0; d < 5; d++) { line(ctx, [p[0], ...digit(p, d)]); ctx.stroke() }
      ctx.lineWidth = 1.1
      p.forEach((q, i) => (i > 0 && i % 4 === 0 ? dot(ctx, q, 3.4, INK) : dot(ctx, q, 2, PAPER, INK)))
    },
  },
  {
    name: 'F  Contour + tracking', note: 'outline with the 21 landmarks inside',
    draw: (ctx, ch, cx, cy, s) => {
      styles[3].draw(ctx, ch, cx, cy, s)
      const p = project(landmarks(LETTERS[ch]), cx, cy, s)
      ctx.strokeStyle = FAINT; ctx.lineWidth = 1
      for (let d = 0; d < 5; d++) { line(ctx, digit(p, d)); ctx.stroke() }
      for (const q of p.slice(1)) dot(ctx, q, 1.7, INK)
    },
  },
]

const letters = ['B', 'L', 'V', 'Y', 'R', 'A', 'O']
const CW = 150, CH = 150, LEFT = 190, TOP = 40
const W = LEFT + CW * letters.length + 20, H = TOP + CH * styles.length + 16
const canvas = document.getElementById('c') as HTMLCanvasElement
const dpr = Math.min(window.devicePixelRatio || 1, 2)
canvas.width = W * dpr; canvas.height = H * dpr
canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
const ctx = canvas.getContext('2d')!
ctx.scale(dpr, dpr)
ctx.lineCap = 'round'; ctx.lineJoin = 'round'
ctx.font = '12px ui-monospace, Menlo, monospace'
ctx.fillStyle = '#6b665b'
letters.forEach((ch, i) => ctx.fillText(ch, LEFT + i * CW + CW / 2 - 4, 24))
styles.forEach((style, r) => {
  const y = TOP + r * CH
  ctx.fillStyle = INK; ctx.font = '13px ui-monospace, Menlo, monospace'; ctx.fillText(style.name, 16, y + CH / 2 - 4)
  ctx.fillStyle = '#6b665b'; ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.fillText(style.note, 16, y + CH / 2 + 14, LEFT - 24)
  ctx.strokeStyle = 'rgba(27,26,23,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(12, y + 0.5); ctx.lineTo(W - 12, y + 0.5); ctx.stroke()
  letters.forEach((ch, i) => { ctx.save(); style.draw(ctx, ch, LEFT + i * CW + CW / 2, y + CH / 2 + 8, 56); ctx.restore(); ctx.lineCap = 'round'; ctx.lineJoin = 'round' })
})
