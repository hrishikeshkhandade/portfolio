import { lerp, smooth } from '../lib/ease'

export interface Lch { l: number; c: number; h: number }
export interface Palette { dark: boolean; paper: Lch; ink: Lch; soft: Lch; signal: Lch }

type Key = readonly [hour: number, l: number, c: number, h: number]

const LIGHT: readonly Key[] = [
  [6, 0.8, 0.045, 55],
  [9, 0.94, 0.022, 80],
  [13, 0.955, 0.018, 88],
  [17, 0.93, 0.028, 78],
  [19.5, 0.79, 0.05, 55],
]
const DARK: readonly Key[] = [
  [19.5, 0.36, 0.03, 50],
  [22, 0.24, 0.015, 60],
  [27, 0.21, 0.012, 70],
  [30, 0.34, 0.03, 50],
]

function sample(keys: readonly Key[], hour: number): Lch {
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1]
    if (hour >= a[0] && hour <= b[0]) {
      const t = smooth((hour - a[0]) / (b[0] - a[0]))
      return { l: lerp(a[1], b[1], t), c: lerp(a[2], b[2], t), h: lerp(a[3], b[3], t) }
    }
  }
  const k = keys[keys.length - 1]
  return { l: k[1], c: k[2], h: k[3] }
}

/** Relative luminance of an OKLCH color (sRGB, channels clamped). */
export function luminance({ l, c, h }: Lch): number {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180)
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const r = clamp(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S)
  const g = clamp(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S)
  const bl = clamp(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S)
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}

export function contrast(a: Lch, b: Lch): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Move lightness away from the paper until the contrast target is met. */
function solve(paper: Lch, dark: boolean, target: number, start: Lch): Lch {
  const color = { ...start }
  const stepDir = dark ? 0.005 : -0.005
  while (contrast(color, paper) < target && color.l > 0.02 && color.l < 0.98) color.l += stepDir
  color.l = Math.round(color.l * 1000) / 1000
  return color
}

/** A scene's own paper color: hue and strength. Lightness still follows the time of day. */
export interface Tint { h: number; c: number }

export function paletteAt(hour: number, tint?: Tint): Palette {
  const h = ((hour % 24) + 24) % 24
  const dark = h < 6 || h >= 19.5
  const base = dark ? sample(DARK, h < 6 ? h + 24 : h) : sample(LIGHT, h)
  // Dark paper carries less color than light paper, or it reads as a colored light rather than a surface.
  const paper = tint ? { l: base.l, c: dark ? tint.c * 0.55 : tint.c, h: tint.h } : base
  const ink: Lch = dark ? { l: 0.92, c: 0.02, h: 85 } : { l: 0.2, c: 0.008, h: 85 }
  const soft = solve(paper, dark, 5, { l: dark ? 0.7 : 0.52, c: 0.015, h: 80 })
  const signal = solve(paper, dark, 4.8, { l: dark ? 0.78 : 0.5, c: dark ? 0.13 : 0.12, h: 155 })
  return { dark, paper, ink, soft, signal }
}

const n = (v: number) => String(Math.round(v * 1000) / 1000)

export function css(color: Lch, alpha?: number): string {
  const base = `${n(color.l)} ${n(color.c)} ${n(color.h)}`
  return alpha === undefined ? `oklch(${base})` : `oklch(${base} / ${alpha})`
}
