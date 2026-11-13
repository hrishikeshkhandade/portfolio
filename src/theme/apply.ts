import { css, paletteAt, type Palette } from './palette'

export type Mode = 'auto' | 'day' | 'night'
const KEY = 'palette-mode'
const ORDER: Mode[] = ['auto', 'day', 'night']

export function getMode(): Mode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'day' || v === 'night') return v
  } catch { /* storage unavailable */ }
  return 'auto'
}

function hourFor(mode: Mode, now: Date): number {
  if (mode === 'day') return 13
  if (mode === 'night') return 23
  return now.getHours() + now.getMinutes() / 60
}

export function applyPalette(mode: Mode = getMode(), now: Date = new Date()): Palette {
  const p = paletteAt(hourFor(mode, now))
  const s = document.documentElement.style
  s.setProperty('--paper', css(p.paper))
  s.setProperty('--ink', css(p.ink))
  s.setProperty('--ink-soft', css(p.soft))
  s.setProperty('--ink-faint', css(p.ink, 0.24))
  s.setProperty('--rule', css(p.ink, 0.18))
  s.setProperty('--wash', css(p.ink, 0.06))
  s.setProperty('--signal', css(p.signal))
  s.setProperty('color-scheme', p.dark ? 'dark' : 'light')
  document.dispatchEvent(new CustomEvent('palettechange'))
  return p
}

export function cycleMode(): Mode {
  const next = ORDER[(ORDER.indexOf(getMode()) + 1) % ORDER.length]
  try {
    if (next === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch { /* storage unavailable */ }
  applyPalette(next)
  return next
}

export function startPalette(): void {
  applyPalette()
  setInterval(() => applyPalette(), 60_000)
}
