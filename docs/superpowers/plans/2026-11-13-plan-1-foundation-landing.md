# Portfolio Plan 1 — Foundation and Landing Scene

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployable single page showing the wordmark, the time-of-day paper-and-ink palette, and the seeded "hand spells, model predicts" landing scene with type-to-spell.

**Architecture:** Vite + TypeScript, no UI framework. Pure logic (random generator, palette, sentence grammar, prediction timeline, hand kinematics) lives in small tested modules; one scene module composes them and draws the hand on a 2D canvas while text and bars are real HTML. Content comes from `content/site.yaml`, compiled to JSON by a 10-line Vite plugin.

**Tech Stack:** Vite, TypeScript, Vitest, `yaml` (build-time only), Fontsource (self-hosted Newsreader + IBM Plex Mono), Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-11-13-portfolio-design.md` (sections 3, 5.1, 7.2, 7.3). Plans 2 and 3 cover navigation/project scenes and about/resume/deploy.

**Hand poses are stylized.** Each letter is described by finger curls, spread, thumb position and rotation, and a small kinematics function turns that into 21 points. They are recognizable approximations of ASL fingerspelling, not recorded data. Plan 2 may replace them with recorded landmarks.

---

## File structure

```
index.html                     shell: wordmark, toggle, scene root, no-JS fallback
vite.config.ts                 yaml plugin, vitest config
tsconfig.json
content/site.yaml              wordmark, status, links, landing sentence frames
src/main.ts                    boot: palette, seed, mount landing
src/yaml.d.ts                  module declaration for *.yaml
src/content/site.ts            typed access to site.yaml
src/styles/base.css            tokens, type, shell layout
src/styles/landing.css         landing scene layout
src/lib/rng.ts                 seeded generator + helpers
src/lib/ease.ts                clamp, lerp, easing
src/theme/palette.ts           palette by hour, contrast math
src/theme/apply.ts             write CSS variables, mode toggle
src/engine/scene.ts            Scene lifecycle interface
src/predict/grammar.ts         sentence frames → sentences
src/predict/timeline.ts        rivals, letter plan, bar values over time
src/hand/skeleton.ts           Pose type, 21-point kinematics, pose blending
src/hand/poses.ts              26 letter poses + rest
src/hand/draw.ts               draw skeleton on canvas
src/scenes/landing.ts          landing scene
tests/*.test.ts                one test file per pure module
```

---

### Task 1: Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `src/yaml.d.ts`, `index.html`, `src/main.ts`

- [ ] **Step 1: Init and install**

```bash
cd ~/portfolio
npm init -y
npm pkg set type=module private=true name=portfolio
npm pkg set scripts.dev="vite" scripts.build="tsc --noEmit && vite build" scripts.preview="vite preview" scripts.test="vitest run"
npm i -D vite vitest typescript yaml
npm i @fontsource-variable/newsreader @fontsource/ibm-plex-mono
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import { parse } from 'yaml'

function yamlPlugin(): Plugin {
  return {
    name: 'yaml',
    transform(code, id) {
      if (!/\.ya?ml$/.test(id)) return null
      return { code: `export default ${JSON.stringify(parse(code))}`, map: null }
    },
  }
}

export default defineConfig({
  plugins: [yamlPlugin()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
```

- [ ] **Step 4: Write `src/yaml.d.ts`**

```ts
declare module '*.yaml' {
  const data: unknown
  export default data
}
```

- [ ] **Step 5: Write minimal `index.html` and `src/main.ts`**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hrishikesh Khandade</title>
  </head>
  <body>
    <div id="scene"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:

```ts
document.getElementById('scene')!.textContent = 'ok'
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: exits 0, prints `dist/index.html`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold vite + typescript project"
```

---

### Task 2: Seeded random generator and easing

**Files:**
- Create: `src/lib/rng.ts`, `src/lib/ease.ts`
- Test: `tests/rng.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/rng.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { mulberry32, pick, range, shuffle, randomSeed } from '../src/lib/rng'

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42), b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('differs between seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
  it('stays in [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
  it('range and pick stay in bounds', () => {
    const r = mulberry32(3)
    for (let i = 0; i < 200; i++) {
      const v = range(r, 2, 5); expect(v).toBeGreaterThanOrEqual(2); expect(v).toBeLessThan(5)
      expect(['a', 'b', 'c']).toContain(pick(r, ['a', 'b', 'c']))
    }
  })
  it('shuffle keeps all items and does not mutate input', () => {
    const src = [1, 2, 3, 4, 5]
    const out = shuffle(mulberry32(9), src)
    expect(src).toEqual([1, 2, 3, 4, 5])
    expect([...out].sort()).toEqual(src)
  })
  it('randomSeed is five digits', () => {
    const s = randomSeed(); expect(s).toBeGreaterThanOrEqual(10000); expect(s).toBeLessThanOrEqual(99999)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/rng.test.ts`
Expected: FAIL, cannot resolve `../src/lib/rng`.

- [ ] **Step 3: Implement** — `src/lib/rng.ts`

```ts
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const range = (rng: Rng, min: number, max: number): number => min + rng() * (max - min)

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export const randomSeed = (): number => 10000 + Math.floor(Math.random() * 90000)
```

`src/lib/ease.ts`:

```ts
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const easeOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3)
export const smooth = (t: number): number => { const c = clamp01(t); return c * c * (3 - 2 * c) }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/rng.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: seeded rng and easing helpers"
```

---

### Task 3: Time-of-day palette with contrast guarantee

**Files:**
- Create: `src/theme/palette.ts`
- Test: `tests/palette.test.ts`

Design: paper lightness never enters the mid-tone band where neither dark nor light ink reaches 7:1. Between 06:00 and 19:30 the paper is light with dark ink; otherwise it is dark with light ink. Label and accent colors are solved against the paper so they always meet their contrast targets.

- [ ] **Step 1: Write the failing test** — `tests/palette.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { paletteAt, contrast, css } from '../src/theme/palette'

describe('palette', () => {
  it('keeps contrast targets at every 10-minute step of the day', () => {
    for (let step = 0; step < 144; step++) {
      const p = paletteAt(step / 6)
      expect(contrast(p.ink, p.paper), `ink @${step / 6}`).toBeGreaterThanOrEqual(7)
      expect(contrast(p.soft, p.paper), `soft @${step / 6}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(p.signal, p.paper), `signal @${step / 6}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('is light by day and dark by night', () => {
    expect(paletteAt(13).dark).toBe(false)
    expect(paletteAt(23).dark).toBe(true)
    expect(paletteAt(3).dark).toBe(true)
  })
  it('stays in a warm hue family', () => {
    for (let h = 0; h < 24; h += 0.5) {
      const hue = paletteAt(h).paper.h
      expect(hue).toBeGreaterThanOrEqual(45); expect(hue).toBeLessThanOrEqual(95)
    }
  })
  it('changes smoothly within the day', () => {
    const a = paletteAt(14).paper, b = paletteAt(14 + 1 / 6).paper
    expect(Math.abs(a.l - b.l)).toBeLessThan(0.01)
  })
  it('wraps hours', () => {
    expect(paletteAt(25)).toEqual(paletteAt(1))
    expect(paletteAt(-1)).toEqual(paletteAt(23))
  })
  it('formats css', () => {
    expect(css({ l: 0.5, c: 0.1, h: 150 })).toBe('oklch(0.5 0.1 150)')
    expect(css({ l: 0.5, c: 0.1, h: 150 }, 0.2)).toBe('oklch(0.5 0.1 150 / 0.2)')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/palette.test.ts`
Expected: FAIL, cannot resolve `../src/theme/palette`.

- [ ] **Step 3: Implement** — `src/theme/palette.ts`

```ts
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

export function paletteAt(hour: number): Palette {
  const h = ((hour % 24) + 24) % 24
  const dark = h < 6 || h >= 19.5
  const paper = dark ? sample(DARK, h < 6 ? h + 24 : h) : sample(LIGHT, h)
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/palette.test.ts`
Expected: PASS, 6 tests. If the contrast test fails at a specific hour, the message names the hour; adjust the `LIGHT`/`DARK` lightness at the nearest keyframe (light paper must stay ≥ 0.75, dark paper ≤ 0.38) and rerun.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: time-of-day palette with enforced contrast"
```

---

### Task 4: Apply palette, base styles, page shell

**Files:**
- Create: `src/theme/apply.ts`, `src/styles/base.css`
- Modify: `index.html`, `src/main.ts`

- [ ] **Step 1: Write `src/theme/apply.ts`**

```ts
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
```

- [ ] **Step 2: Write `src/styles/base.css`**

```css
:root {
  --paper: #f4efe4;
  --ink: #1b1a17;
  --ink-soft: #6b665b;
  --ink-faint: rgba(27, 26, 23, 0.24);
  --rule: rgba(27, 26, 23, 0.18);
  --wash: rgba(27, 26, 23, 0.06);
  --signal: #1f7a4d;

  --serif: 'Newsreader Variable', 'Iowan Old Style', Georgia, serif;
  --mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace;

  --t-cap: 11px;
  --t-body: 14px;
  --t-h3: 18px;
  --t-h2: 22px;
  --t-h1: 28px;
  --t-display: 44px;

  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px;
  --ease: cubic-bezier(0.23, 1, 0.32, 1);
}

*, *::before, *::after { box-sizing: border-box; }

html, body { height: 100%; margin: 0; }

body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--mono);
  font-size: var(--t-body);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  transition: background-color 1.5s linear, color 1.5s linear;
}

.sr-only {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}

.shell { position: fixed; inset: 0; display: grid; grid-template-rows: auto 1fr auto; }

.top, .bottom {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  padding: var(--s4) var(--s5); font-size: var(--t-cap); color: var(--ink-soft);
}
.top > :last-child, .bottom > :last-child { justify-self: end; }

.wordmark {
  font-family: var(--serif); font-size: var(--t-h2); font-weight: 400;
  letter-spacing: -0.01em; color: var(--ink); margin: 0; white-space: nowrap;
}

.key {
  font: inherit; color: var(--ink-soft); background: none; cursor: pointer;
  border: 1px solid var(--rule); border-radius: 4px;
  padding: var(--s1) var(--s2); min-height: 28px; position: relative;
  transition: color 160ms var(--ease), border-color 160ms var(--ease), transform 120ms var(--ease);
}
.key::after { content: ''; position: absolute; inset: -8px; }
.key:hover { color: var(--ink); border-color: var(--ink-faint); }
.key:active { transform: scale(0.97); }
.key:focus-visible, a:focus-visible, input:focus-visible {
  outline: 1px solid var(--signal); outline-offset: 3px;
}

#scene { min-height: 0; position: relative; }

@media (max-width: 640px) {
  .top, .bottom { padding: var(--s3) var(--s4); }
  .wordmark { font-size: var(--t-h3); }
}

@media (prefers-reduced-motion: reduce) {
  body, .key { transition: none; }
}
```

- [ ] **Step 3: Replace `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Hrishikesh Khandade builds and ships AI products: ASLive, Super Scholar, Chef's Fridge." />
    <title>Hrishikesh Khandade — builds AI products</title>
  </head>
  <body>
    <div class="shell">
      <header class="top">
        <span></span>
        <h1 class="wordmark">Hrishikesh Khandade</h1>
        <button class="key" id="mode" type="button" aria-label="Change palette: auto">auto</button>
      </header>
      <main id="scene">
        <noscript>
          <p style="padding:24px;max-width:40ch;font-family:Georgia,serif;font-size:18px">
            I build and ship AI products. Find my work on
            <a href="https://github.com/hrishikeshkhandade">GitHub</a> and
            <a href="https://www.linkedin.com/in/hrishikeshkhandade">LinkedIn</a>.
          </p>
        </noscript>
      </main>
      <footer class="bottom">
        <span></span>
        <span></span>
        <span id="seed"></span>
      </footer>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Replace `src/main.ts`**

```ts
import '@fontsource-variable/newsreader'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './styles/base.css'
import { cycleMode, getMode, startPalette } from './theme/apply'

startPalette()

const modeBtn = document.getElementById('mode') as HTMLButtonElement
const showMode = (m: string) => {
  modeBtn.textContent = m
  modeBtn.setAttribute('aria-label', `Change palette: ${m}`)
}
showMode(getMode())
modeBtn.addEventListener('click', () => showMode(cycleMode()))
```

- [ ] **Step 5: Verify in browser**

Run: `npm run dev`, open the printed local URL.
Expected: warm paper background (or dark warm charcoal after 19:30), serif wordmark centered, a small button top-right cycling `auto → day → night`, and the page recoloring over ~1.5 s on each click. Run `npm run build`; expected exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: page shell, tokens and palette toggle"
```

---

### Task 5: Site content and sentence grammar

**Files:**
- Create: `content/site.yaml`, `src/content/site.ts`, `src/predict/grammar.ts`
- Test: `tests/grammar.test.ts`

A sentence is one opener + one middle + one ending from the same frame. Every combination inside a frame must be true and grammatical; that is the author's rule when editing the file.

- [ ] **Step 1: Write `content/site.yaml`**

```yaml
wordmark: Hrishikesh Khandade
status: CS at Illinois · shipped on two app stores
links:
  - { label: GitHub, url: "https://github.com/hrishikeshkhandade" }
  - { label: LinkedIn, url: "https://www.linkedin.com/in/hrishikeshkhandade" }
landing:
  frames:
    - openers: ["I build", "I ship", "I make", "I write"]
      middles: ["software", "apps", "tools", "small machines"]
      endings:
        - "that can read hands"
        - "that can turn papers into games"
        - "that can cook from a fridge photo"
        - "that people actually use"
        - "that can run on your own device"
        - "that made it to two app stores"
    - openers: ["I taught", "I trained", "I got"]
      middles: ["a model", "a classifier", "a laptop camera", "a random forest"]
      endings:
        - "to read sign language"
        - "to spell with its eyes"
        - "to tell B from F"
        - "to keep up with fingers"
        - "to answer in under 100 ms"
    - openers: ["Currently", "This semester", "Right now", "These days"]
      middles: ["turning", "compiling", "rebuilding"]
      endings:
        - "research papers into platformers"
        - "PDFs into boss fights"
        - "47 pages into one level"
        - "dense papers into playable worlds"
    - openers: ["Freshman at Illinois,", "CS at Illinois,", "Dubai to Champaign,", "Chess player,", "Math olympian,"]
      middles: ["still", "mostly", "always"]
      endings:
        - "shipping"
        - "building things"
        - "debugging"
        - "counting parity"
        - "looking for the next problem"
    - openers: ["Hello.", "Hi.", "Welcome."]
      middles: ["This hand", "This model", "This page"]
      endings:
        - "is spelling for you"
        - "learned 26 letters"
        - "is guessing the next letter"
        - "never repeats itself"
```

- [ ] **Step 2: Write `src/content/site.ts`**

```ts
import raw from '../../content/site.yaml'
import type { Frame } from '../predict/grammar'

export interface SiteContent {
  wordmark: string
  status: string
  links: { label: string; url: string }[]
  landing: { frames: Frame[] }
}

export const site = raw as SiteContent
```

- [ ] **Step 3: Write the failing test** — `tests/grammar.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { allSentences, countSentences, makeSentence } from '../src/predict/grammar'
import { mulberry32 } from '../src/lib/rng'
import { site } from '../src/content/site'

const frames = site.landing.frames

describe('grammar', () => {
  it('offers at least 300 sentences', () => {
    expect(countSentences(frames)).toBeGreaterThanOrEqual(300)
    expect(allSentences(frames)).toHaveLength(countSentences(frames))
  })
  it('has no duplicates', () => {
    const all = allSentences(frames)
    expect(new Set(all).size).toBe(all.length)
  })
  it('uses only supported characters and sane lengths', () => {
    for (const s of allSentences(frames)) {
      expect(s).toMatch(/^[A-Za-z0-9 ,.'-]+$/)
      expect(s.length).toBeLessThanOrEqual(64)
      expect(s).not.toMatch(/\s{2,}/)
    }
  })
  it('is deterministic per seed and always a known sentence', () => {
    const all = new Set(allSentences(frames))
    const a = mulberry32(5), b = mulberry32(5)
    for (let i = 0; i < 50; i++) {
      const s = makeSentence(a, frames)
      expect(s).toBe(makeSentence(b, frames))
      expect(all.has(s)).toBe(true)
    }
  })
  it('reaches every frame', () => {
    const r = mulberry32(11)
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) seen.add(makeSentence(r, frames).split(' ')[0])
    for (const f of frames) expect(f.openers.some((o) => seen.has(o.split(' ')[0]))).toBe(true)
  })
})
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run tests/grammar.test.ts`
Expected: FAIL, cannot resolve `../src/predict/grammar`.

- [ ] **Step 5: Implement** — `src/predict/grammar.ts`

```ts
import { pick, type Rng } from '../lib/rng'

export interface Frame { openers: string[]; middles: string[]; endings: string[] }

const size = (f: Frame): number => f.openers.length * f.middles.length * f.endings.length

export const countSentences = (frames: Frame[]): number => frames.reduce((n, f) => n + size(f), 0)

export function allSentences(frames: Frame[]): string[] {
  const out: string[] = []
  for (const f of frames)
    for (const o of f.openers) for (const m of f.middles) for (const e of f.endings) out.push(`${o} ${m} ${e}`)
  return out
}

/** Picks a frame in proportion to how many sentences it holds, so every sentence is equally likely. */
export function makeSentence(rng: Rng, frames: Frame[]): string {
  let roll = rng() * countSentences(frames)
  let frame = frames[frames.length - 1]
  for (const f of frames) {
    roll -= size(f)
    if (roll < 0) { frame = f; break }
  }
  return `${pick(rng, frame.openers)} ${pick(rng, frame.middles)} ${pick(rng, frame.endings)}`
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run tests/grammar.test.ts`
Expected: PASS, 5 tests (315 sentences).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: site content and sentence grammar"
```

---

### Task 6: Prediction timeline

**Files:**
- Create: `src/predict/timeline.ts`
- Test: `tests/timeline.test.ts`

A letter plan holds the correct letter, three look-alike rivals, their final probabilities, and a behavior: `confident` (straight to the answer), `hesitant` (a rival leads briefly), `corrected` (a rival leads for more than half the time, then the model corrects). `barsAt` returns the four displayed probabilities at progress `t`; index 0 is always the correct letter.

- [ ] **Step 1: Write the failing test** — `tests/timeline.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { CONFUSION, barsAt, leaderAt, pickRivals, planLetter } from '../src/predict/timeline'
import { mulberry32 } from '../src/lib/rng'

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

describe('timeline', () => {
  it('has a confusion set for every letter that excludes itself', () => {
    for (const ch of AZ) {
      expect(CONFUSION[ch].length).toBeGreaterThanOrEqual(3)
      expect(CONFUSION[ch]).not.toContain(ch)
      expect(CONFUSION[ch]).toMatch(/^[A-Z]+$/)
    }
  })
  it('picks three distinct rivals, never the letter', () => {
    const r = mulberry32(1)
    for (const ch of AZ) for (let i = 0; i < 20; i++) {
      const rivals = pickRivals(r, ch)
      expect(rivals).toHaveLength(3)
      expect(new Set(rivals).size).toBe(3)
      expect(rivals).not.toContain(ch)
    }
  })
  it('plans probabilities that sum to 1 with a clear winner', () => {
    const r = mulberry32(2)
    for (let i = 0; i < 300; i++) {
      const p = planLetter(r, AZ[i % 26])
      expect(sum(p.probs)).toBeCloseTo(1, 6)
      expect(p.probs[0]).toBeGreaterThanOrEqual(0.82)
      expect(p.probs[0]).toBeLessThanOrEqual(0.97)
      expect(p.probs[1]).toBeGreaterThanOrEqual(p.probs[2])
      expect(p.probs[2]).toBeGreaterThanOrEqual(p.probs[3])
      expect(p.ms).toBeGreaterThanOrEqual(450)
    }
  })
  it('always ends on the correct letter with the planned values', () => {
    const r = mulberry32(3)
    for (let i = 0; i < 200; i++) {
      const p = planLetter(r, 'B')
      expect(leaderAt(p, 1)).toBe(0)
      barsAt(p, 1).forEach((v, k) => expect(v).toBeCloseTo(p.probs[k], 6))
    }
  })
  it('keeps bars normalized and in range throughout', () => {
    const r = mulberry32(4)
    for (let i = 0; i < 60; i++) {
      const p = planLetter(r, 'M')
      for (let t = 0; t <= 1; t += 0.05) {
        const bars = barsAt(p, t)
        expect(sum(bars)).toBeCloseTo(1, 6)
        bars.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) })
      }
    }
  })
  it('lets a rival lead mid-way when corrected', () => {
    const r = mulberry32(5)
    let seen = 0
    for (let i = 0; i < 400; i++) {
      const p = planLetter(r, 'S')
      if (p.behavior === 'corrected') { seen++; expect(leaderAt(p, 0.4)).toBe(1) }
      if (p.behavior === 'confident') expect(leaderAt(p, 0.4)).toBe(0)
    }
    expect(seen).toBeGreaterThan(10)
    expect(seen).toBeLessThan(80)
  })
  it('is deterministic per seed', () => {
    expect(planLetter(mulberry32(9), 'K')).toEqual(planLetter(mulberry32(9), 'K'))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/timeline.test.ts`
Expected: FAIL, cannot resolve `../src/predict/timeline`.

- [ ] **Step 3: Implement** — `src/predict/timeline.ts`

```ts
import { easeOut, lerp } from '../lib/ease'
import { range, shuffle, type Rng } from '../lib/rng'

/** Letters whose ASL handshapes are commonly mistaken for each other. */
export const CONFUSION: Record<string, string> = {
  A: 'ESTMN', B: 'FWU', C: 'OEX', D: 'ZXG', E: 'SAOM', F: 'BWD', G: 'HQZ', H: 'GUR', I: 'JYS',
  J: 'IYZ', K: 'VPR', L: 'GDY', M: 'NSTA', N: 'MTSA', O: 'CES', P: 'KQG', Q: 'GPH', R: 'UVH',
  S: 'ATEM', T: 'NMSA', U: 'RVH', V: 'UKW', W: 'VBF', X: 'DCZ', Y: 'IJL', Z: 'DXG',
}

export type Behavior = 'confident' | 'hesitant' | 'corrected'

export interface LetterPlan {
  letter: string
  rivals: [string, string, string]
  /** Final probabilities: [letter, rival 1, rival 2, rival 3], rivals in descending order. */
  probs: [number, number, number, number]
  behavior: Behavior
  ms: number
}

export function pickRivals(rng: Rng, letter: string): [string, string, string] {
  const [a, b, c] = shuffle(rng, CONFUSION[letter].split(''))
  return [a, b, c]
}

export function planLetter(rng: Rng, letter: string): LetterPlan {
  const rivals = pickRivals(rng, letter)
  const win = range(rng, 0.82, 0.97)
  const weights = [rng() + 0.2, rng() + 0.2, rng() + 0.2].sort((x, y) => y - x)
  const total = weights[0] + weights[1] + weights[2]
  const rest = 1 - win
  const roll = rng()
  const behavior: Behavior = roll < 1 / 12 ? 'corrected' : roll < 0.3 ? 'hesitant' : 'confident'
  const ms = range(rng, 450, 650) * (behavior === 'confident' ? 1 : behavior === 'hesitant' ? 1.4 : 1.8)
  return {
    letter,
    rivals,
    probs: [win, (rest * weights[0]) / total, (rest * weights[1]) / total, (rest * weights[2]) / total],
    behavior,
    ms,
  }
}

const UNIFORM = [0.25, 0.25, 0.25, 0.25]
const DETOUR: Record<Behavior, { at: number; via: number[] }> = {
  confident: { at: 0, via: UNIFORM },
  hesitant: { at: 0.4, via: [0.36, 0.4, 0.14, 0.1] },
  corrected: { at: 0.55, via: [0.18, 0.58, 0.14, 0.1] },
}

/** Displayed probabilities at progress t in [0, 1]. Index 0 is the correct letter. */
export function barsAt(plan: LetterPlan, t: number): number[] {
  const { at, via } = DETOUR[plan.behavior]
  if (at === 0) return plan.probs.map((p, i) => lerp(UNIFORM[i], p, easeOut(t)))
  if (t < at) return via.map((v, i) => lerp(UNIFORM[i], v, easeOut(t / at)))
  return plan.probs.map((p, i) => lerp(via[i], p, easeOut((t - at) / (1 - at))))
}

export function leaderAt(plan: LetterPlan, t: number): number {
  const bars = barsAt(plan, t)
  let best = 0
  for (let i = 1; i < bars.length; i++) if (bars[i] > bars[best]) best = i
  return best
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/timeline.test.ts`
Expected: PASS, 7 tests. (In `confident` plans at t = 0.4 the winner already leads because every bar starts equal and the winner's target is the largest.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: prediction timeline with rivals and behaviors"
```

---

### Task 7: Hand skeleton and letter poses

**Files:**
- Create: `src/hand/skeleton.ts`, `src/hand/poses.ts`
- Test: `tests/hand.test.ts`

Coordinates: wrist at (0, 0), y grows upward, one unit ≈ palm height. Point order follows MediaPipe: 0 wrist; 1–4 thumb; 5–8 index; 9–12 middle; 13–16 ring; 17–20 pinky. A curled finger is drawn foreshortened: each joint adds flexion, and a segment's drawn length is its real length times the cosine of the accumulated flexion, so a fully curled finger folds back over the palm.

- [ ] **Step 1: Write the failing test** — `tests/hand.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { BONES, landmarks, lerpPose } from '../src/hand/skeleton'
import { LETTERS, REST } from '../src/hand/poses'

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const TIP = { index: 8, middle: 12, ring: 16, pinky: 20 }

describe('hand', () => {
  it('defines every letter', () => {
    for (const ch of AZ) expect(LETTERS[ch], ch).toBeDefined()
  })
  it('produces 21 finite points for every pose', () => {
    for (const pose of [REST, ...AZ.map((c) => LETTERS[c])]) {
      const pts = landmarks(pose)
      expect(pts).toHaveLength(21)
      for (const [x, y] of pts) { expect(Number.isFinite(x)).toBe(true); expect(Number.isFinite(y)).toBe(true) }
      expect(pts[0]).toEqual([0, 0])
    }
  })
  it('keeps every pose inside a sane box', () => {
    for (const ch of AZ) for (const [x, y] of landmarks(LETTERS[ch])) {
      expect(Math.abs(x)).toBeLessThan(2.2); expect(Math.abs(y - 0.6)).toBeLessThan(2.2)
    }
  })
  it('extends and curls the right fingers', () => {
    const a = landmarks(LETTERS.A), b = landmarks(LETTERS.B), l = landmarks(LETTERS.L), y = landmarks(LETTERS.Y)
    expect(b[TIP.index][1]).toBeGreaterThan(a[TIP.index][1] + 0.5)
    expect(l[TIP.index][1]).toBeGreaterThan(l[TIP.middle][1] + 0.5)
    expect(y[TIP.pinky][1]).toBeGreaterThan(y[TIP.ring][1] + 0.3)
  })
  it('spreads V wider than U', () => {
    const gap = (ch: string) => { const p = landmarks(LETTERS[ch]); return Math.abs(p[TIP.middle][0] - p[TIP.index][0]) }
    expect(gap('V')).toBeGreaterThan(gap('U') + 0.1)
  })
  it('points G sideways', () => {
    const g = landmarks(LETTERS.G)
    expect(Math.abs(g[TIP.index][0])).toBeGreaterThan(0.8)
  })
  it('gives distinct shapes for look-alikes that differ by one finger', () => {
    const dist = (a: string, b: string) => {
      const p = landmarks(LETTERS[a]), q = landmarks(LETTERS[b])
      return Math.max(...p.map(([x, y], i) => Math.hypot(x - q[i][0], y - q[i][1])))
    }
    for (const [a, b] of [['M', 'N'], ['U', 'V'], ['U', 'R'], ['A', 'S'], ['I', 'Y'], ['G', 'H'], ['K', 'P']])
      expect(dist(a, b), `${a}/${b}`).toBeGreaterThan(0.08)
  })
  it('mirrors left and right hands', () => {
    const r = landmarks(LETTERS.L), m = landmarks(LETTERS.L, true)
    r.forEach(([x, y], i) => { expect(m[i][0]).toBeCloseTo(-x, 9); expect(m[i][1]).toBeCloseTo(y, 9) })
  })
  it('blends poses', () => {
    expect(lerpPose(LETTERS.A, LETTERS.B, 0)).toEqual(LETTERS.A)
    expect(lerpPose(LETTERS.A, LETTERS.B, 1)).toEqual(LETTERS.B)
    expect(lerpPose(LETTERS.A, LETTERS.B, 0.5).curl[0]).toBeCloseTo(0.5, 9)
  })
  it('connects all 21 points with 21 bones', () => {
    expect(BONES).toHaveLength(21)
    const used = new Set(BONES.flat())
    for (let i = 0; i < 21; i++) expect(used.has(i)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/hand.test.ts`
Expected: FAIL, cannot resolve `../src/hand/skeleton`.

- [ ] **Step 3: Implement** — `src/hand/skeleton.ts`

```ts
import { lerp } from '../lib/ease'

export type Pt = [number, number]

export interface Pose {
  /** Flexion per finger [index, middle, ring, pinky]: 0 straight, 1 fist. */
  curl: [number, number, number, number]
  /** Finger spread: 0 together, 1 wide, negative crosses fingers. */
  spread: number
  /** Thumb direction in degrees from straight up (negative = away from palm) and its flexion. */
  thumb: { angle: number; curl: number }
  /** Whole-hand rotation in degrees, clockwise positive. */
  rot: number
}

const RAD = Math.PI / 180
const KNUCKLE: Pt[] = [[-0.3, 0.92], [-0.08, 1.0], [0.13, 0.95], [0.32, 0.82]]
const LENGTH = [[0.42, 0.26, 0.2], [0.46, 0.3, 0.22], [0.42, 0.27, 0.2], [0.32, 0.2, 0.17]]
const BASE_ANGLE = [-8, -2, 5, 12]
const SPREAD_ANGLE = [-14, -4, 6, 16]
const FLEX = [80, 100, 70]
const THUMB_ROOT: Pt = [-0.34, 0.28]
const THUMB_LENGTH = [0.3, 0.26, 0.22]
const PIVOT: Pt = [0, 0.5]

export const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]
/** Bones across the palm, drawn fainter. */
export const PALM_BONES = new Set([8, 12, 16])

export function landmarks(pose: Pose, mirror = false): Pt[] {
  const pts: Pt[] = [[0, 0]]

  let [x, y] = THUMB_ROOT
  pts.push([x, y])
  let angle = pose.thumb.angle
  for (const len of THUMB_LENGTH) {
    const drawn = len * (1 - 0.35 * pose.thumb.curl)
    x += Math.sin(angle * RAD) * drawn
    y += Math.cos(angle * RAD) * drawn
    pts.push([x, y])
    angle += 18 + 30 * pose.thumb.curl
  }

  for (let f = 0; f < 4; f++) {
    let [fx, fy] = KNUCKLE[f]
    pts.push([fx, fy])
    const dir = (BASE_ANGLE[f] + SPREAD_ANGLE[f] * pose.spread) * RAD
    let flex = 0
    for (let j = 0; j < 3; j++) {
      flex += pose.curl[f] * FLEX[j] * RAD
      const drawn = LENGTH[f][j] * Math.cos(flex)
      fx += Math.sin(dir) * drawn + 0.03 * Math.sin(flex)
      fy += Math.cos(dir) * drawn
      pts.push([fx, fy])
    }
  }

  const theta = -pose.rot * RAD
  const cos = Math.cos(theta), sin = Math.sin(theta)
  return pts.map(([px, py]): Pt => {
    const dx = px - PIVOT[0], dy = py - PIVOT[1]
    const rx = PIVOT[0] + dx * cos - dy * sin, ry = PIVOT[1] + dx * sin + dy * cos
    return [mirror ? -rx || 0 : rx, ry || 0]
  })
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  if (t <= 0) return a
  if (t >= 1) return b
  return {
    curl: [0, 1, 2, 3].map((i) => lerp(a.curl[i], b.curl[i], t)) as Pose['curl'],
    spread: lerp(a.spread, b.spread, t),
    thumb: { angle: lerp(a.thumb.angle, b.thumb.angle, t), curl: lerp(a.thumb.curl, b.thumb.curl, t) },
    rot: lerp(a.rot, b.rot, t),
  }
}
```

`-rx || 0` and `ry || 0` turn a `-0` result into `0`, so the wrist is exactly `[0, 0]` when the hand is not rotated.

- [ ] **Step 4: Implement** — `src/hand/poses.ts`

```ts
import type { Pose } from './skeleton'

const OUT = { angle: -70, curl: 0 }
const SIDE = { angle: -18, curl: 0.1 }
const UP = { angle: -8, curl: 0 }
const HALF = { angle: -40, curl: 0.2 }
const ACROSS = { angle: 50, curl: 0.35 }
const TUCK = { angle: 62, curl: 0.6 }
const PINCH = { angle: 30, curl: 0.3 }
const ALONG = { angle: -10, curl: 0.1 }

const pose = (curl: Pose['curl'], thumb: Pose['thumb'], spread = 0, rot = 0): Pose => ({ curl, spread, thumb, rot })

export const REST: Pose = pose([0.25, 0.3, 0.35, 0.4], HALF, 0.3)

export const LETTERS: Record<string, Pose> = {
  A: pose([1, 1, 1, 1], SIDE),
  B: pose([0, 0, 0, 0], ACROSS),
  C: pose([0.45, 0.45, 0.45, 0.45], HALF, 0.2, -20),
  D: pose([0, 0.8, 0.8, 0.8], ACROSS),
  E: pose([0.85, 0.85, 0.85, 0.85], TUCK),
  F: pose([0.75, 0, 0, 0], PINCH, 0.7),
  G: pose([0, 1, 1, 1], ALONG, 0, -90),
  H: pose([0, 0, 1, 1], ACROSS, 0, -90),
  I: pose([1, 1, 1, 0], ACROSS),
  J: pose([1, 1, 1, 0], ACROSS, 0, 25),
  K: pose([0, 0.3, 1, 1], UP, 0.6),
  L: pose([0, 1, 1, 1], OUT),
  M: pose([0.75, 0.75, 0.75, 1], TUCK),
  N: pose([0.75, 0.75, 1, 1], TUCK),
  O: pose([0.6, 0.6, 0.6, 0.6], PINCH),
  P: pose([0, 0.3, 1, 1], UP, 0.6, 140),
  Q: pose([0, 1, 1, 1], ALONG, 0, 160),
  R: pose([0, 0, 1, 1], ACROSS, -0.6),
  S: pose([1, 1, 1, 1], ACROSS),
  T: pose([0.75, 1, 1, 1], PINCH),
  U: pose([0, 0, 1, 1], ACROSS),
  V: pose([0, 0, 1, 1], ACROSS, 1),
  W: pose([0, 0, 0, 1], ACROSS, 1),
  X: pose([0.5, 1, 1, 1], ACROSS),
  Y: pose([1, 1, 1, 0], OUT, 1),
  Z: pose([0, 1, 1, 1], ACROSS, 0, 15),
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/hand.test.ts`
Expected: PASS, 10 tests. If a look-alike pair falls under the 0.08 distance, widen the difference in that pair's pose (curl or thumb) and rerun.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: hand kinematics and 26 letter poses"
```

---

### Task 8: Draw the hand

**Files:**
- Create: `src/hand/draw.ts`

Drawing is verified by eye in Task 10; there is no unit test for canvas output.

- [ ] **Step 1: Implement** — `src/hand/draw.ts`

```ts
import { BONES, PALM_BONES, type Pt } from './skeleton'

export interface HandStyle { ink: string; faint: string; paper: string }

export interface HandView {
  /** Canvas position of the hand's center, in CSS pixels. */
  cx: number
  cy: number
  /** CSS pixels per hand unit. */
  scale: number
  pointer: Pt | null
}

const REACH = 140
const LEAN = 5

export function project(pts: Pt[], view: HandView): Pt[] {
  return pts.map(([x, y]): Pt => {
    let px = view.cx + x * view.scale, py = view.cy - (y - 0.6) * view.scale
    if (view.pointer) {
      const dx = view.pointer[0] - px, dy = view.pointer[1] - py
      const d = Math.hypot(dx, dy)
      if (d > 0.001 && d < REACH) {
        const pull = (1 - d / REACH) * LEAN
        px += (dx / d) * pull
        py += (dy / d) * pull
      }
    }
    return [px, py]
  })
}

export function drawHand(ctx: CanvasRenderingContext2D, pts: Pt[], view: HandView, style: HandStyle): void {
  const p = project(pts, view)

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of p) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
  const pad = view.scale * 0.16
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.strokeStyle = style.faint
  ctx.setLineDash([3, 4])
  ctx.strokeRect(Math.round(minX - pad) + 0.5, Math.round(minY - pad) + 0.5, Math.round(maxX - minX + pad * 2), Math.round(maxY - minY + pad * 2))
  ctx.setLineDash([])

  BONES.forEach(([a, b], i) => {
    ctx.strokeStyle = PALM_BONES.has(i) || i === 20 ? style.faint : style.ink
    ctx.beginPath()
    ctx.moveTo(p[a][0], p[a][1])
    ctx.lineTo(p[b][0], p[b][1])
    ctx.stroke()
  })

  ctx.fillStyle = style.paper
  ctx.strokeStyle = style.ink
  p.forEach(([x, y], i) => {
    ctx.beginPath()
    ctx.arc(x, y, i === 0 ? 3.5 : 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: canvas hand renderer"
```

---

### Task 9: Landing scene

**Files:**
- Create: `src/engine/scene.ts`, `src/scenes/landing.ts`, `src/styles/landing.css`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/engine/scene.ts`**

```ts
export interface Scene {
  /** Build DOM inside root. Called once. */
  mount(root: HTMLElement): void
  /** Begin or resume animation. */
  start(): void
  /** Pause animation; keep DOM. */
  stop(): void
  /** Remove DOM and listeners. */
  destroy(): void
}
```

- [ ] **Step 2: Write `src/styles/landing.css`**

```css
.landing {
  position: absolute; inset: 0;
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center; gap: var(--s6);
  padding: 0 var(--s7);
  max-width: 1200px; margin: 0 auto;
}
.landing[data-side='right'] .hand { order: 2; }

.hand { position: relative; height: min(64vh, 520px); }
.hand canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: pan-y; }
.cap { position: absolute; left: 0; margin: 0; font-size: var(--t-cap); color: var(--ink-soft); }
.cap-top { top: 0; }
.cap-bot { bottom: 0; }

.read { display: grid; gap: var(--s5); align-content: center; min-width: 0; }

.label { margin: 0 0 var(--s2); font-size: var(--t-cap); color: var(--ink-soft); }

.cands { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s1); max-width: 280px; }
.cands li {
  display: grid; grid-template-columns: 16px 1fr 36px; align-items: center; gap: var(--s3);
  font-size: var(--t-cap); color: var(--ink-soft); height: 20px;
}
.cands .bar { height: 5px; }
.cands .bar i { display: block; height: 100%; background: var(--ink-faint); transform-origin: left; transform: scaleX(0.25); }
.cands .p { text-align: right; }
.cands li.chosen { color: var(--signal); font-weight: 500; }
.cands li.chosen .bar { height: 8px; }
.cands li.chosen .bar i { background: var(--signal); }

.sentence {
  margin: 0; font-family: var(--serif); font-size: clamp(var(--t-h1), 3.4vw, var(--t-display));
  line-height: 1.12; letter-spacing: -0.02em; min-height: 3.4em; text-wrap: balance;
}
.sentence .tent { color: var(--signal); }
.sentence .caret {
  display: inline-block; width: 0.08em; height: 0.82em; margin-left: 0.06em;
  background: var(--ink-faint); vertical-align: -0.06em;
}

.status { margin: 0; font-size: var(--t-cap); color: var(--ink-soft); }

.spell-row { display: flex; align-items: center; gap: var(--s3); min-height: 32px; }
.spell-input {
  font: inherit; color: var(--ink); background: var(--wash);
  border: 0; border-bottom: 1px solid var(--rule); border-radius: 2px 2px 0 0;
  padding: var(--s1) var(--s2); width: 18ch; height: 28px; text-transform: lowercase;
}
.spell-input::placeholder { color: var(--ink-soft); }
[hidden] { display: none !important; }

@media (max-width: 760px) {
  .landing {
    grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto;
    gap: var(--s4); padding: 0 var(--s4) var(--s4); align-items: stretch;
  }
  .landing[data-side='right'] .hand { order: 0; }
  .hand { height: auto; min-height: 220px; }
  .read { gap: var(--s4); }
  .sentence { font-size: var(--t-h1); min-height: 3.4em; }
}
```

- [ ] **Step 3: Write `src/scenes/landing.ts`**

```ts
import '../styles/landing.css'
import type { Scene } from '../engine/scene'
import { site } from '../content/site'
import { easeOut } from '../lib/ease'
import { mulberry32, range, shuffle } from '../lib/rng'
import { makeSentence } from '../predict/grammar'
import { barsAt, leaderAt, planLetter, type LetterPlan } from '../predict/timeline'
import { drawHand, type HandStyle } from '../hand/draw'
import { LETTERS, REST } from '../hand/poses'
import { landmarks, lerpPose, type Pose, type Pt } from '../hand/skeleton'

const POSE_MS = 300
const GAP_MS = 110
const SPACE_MS = 150
const END_HOLD_MS = 2600
const MAX_WORD = 16

const isLetter = (ch: string): boolean => /[a-z]/i.test(ch)
const matchCase = (letter: string, like: string): string => (like === like.toLowerCase() ? letter.toLowerCase() : letter)

function readStyle(): HandStyle {
  const s = getComputedStyle(document.documentElement)
  return {
    ink: s.getPropertyValue('--ink').trim(),
    faint: s.getPropertyValue('--ink-faint').trim(),
    paper: s.getPropertyValue('--paper').trim(),
  }
}

export function createLanding(seed: number): Scene {
  const rng = mulberry32(seed)
  const mirror = rng() < 0.5
  const side = rng() < 0.5 ? 'left' : 'right'
  const tilt = range(rng, -6, 6)
  const speed = range(rng, 0.85, 1.2)
  const frames = site.landing.frames
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  let el: HTMLElement
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let rows: { li: HTMLLIElement; ch: HTMLElement; bar: HTMLElement; p: HTMLElement }[] = []
  let doneEl: HTMLElement, tentEl: HTMLElement, srEl: HTMLElement, latEl: HTMLElement
  let spellBtn: HTMLButtonElement, input: HTMLInputElement
  let observer: ResizeObserver | null = null

  let style = readStyle()
  let width = 0, height = 0
  let raf = 0
  let running = false

  let sentence = ''
  let idx = 0
  let plan: LetterPlan | null = null
  let order = [0, 1, 2, 3]
  let planStart = 0
  let holdUntil = 0

  let from: Pose = REST, to: Pose = REST, cur: Pose = REST
  let poseStart = 0
  let pointer: Pt | null = null

  function aim(target: Pose, now: number): void {
    from = cur
    to = target
    poseStart = now
  }

  function begin(text: string): void {
    sentence = text
    idx = 0
    plan = null
    doneEl.textContent = ''
    tentEl.textContent = ''
    srEl.textContent = text
  }

  function showBars(bars: number[], chosen: boolean): void {
    if (!plan) return
    const chars = [plan.letter, ...plan.rivals]
    rows.forEach((row, k) => {
      const i = order[k]
      row.ch.textContent = chars[i]
      row.bar.style.transform = `scaleX(${bars[i].toFixed(3)})`
      row.p.textContent = bars[i].toFixed(2)
      row.li.classList.toggle('chosen', chosen && i === 0)
    })
  }

  function startLetter(ch: string, now: number): void {
    plan = planLetter(rng, ch.toUpperCase())
    plan.ms /= speed
    order = shuffle(rng, [0, 1, 2, 3])
    planStart = now
    latEl.textContent = String(Math.round(range(rng, 68, 98)))
    aim(LETTERS[plan.letter], now)
  }

  function advance(now: number): void {
    if (now < holdUntil) return

    if (plan) {
      const t = Math.min(1, (now - planStart) / plan.ms)
      showBars(barsAt(plan, t), t >= 0.85)
      const ch = sentence[idx]
      if (t < 1) {
        const lead = leaderAt(plan, t)
        tentEl.textContent = matchCase([plan.letter, ...plan.rivals][lead], ch)
        return
      }
      doneEl.textContent += ch
      tentEl.textContent = ''
      plan = null
      idx++
      holdUntil = now + (idx >= sentence.length ? END_HOLD_MS : GAP_MS)
      return
    }

    if (idx >= sentence.length) {
      begin(makeSentence(rng, frames))
      aim(REST, now)
      holdUntil = now + 400
      return
    }

    const ch = sentence[idx]
    if (isLetter(ch)) {
      startLetter(ch, now)
      return
    }
    doneEl.textContent += ch
    idx++
    if (ch === ' ') { aim(REST, now); holdUntil = now + SPACE_MS / speed }
    if (idx >= sentence.length) holdUntil = now + END_HOLD_MS
  }

  function draw(now: number): void {
    cur = lerpPose(from, to, easeOut((now - poseStart) / (POSE_MS / speed)))
    ctx.clearRect(0, 0, width, height)
    const pts = landmarks({ ...cur, rot: cur.rot + tilt }, mirror)
    drawHand(ctx, pts, { cx: width / 2, cy: height / 2, scale: Math.min(width, height) * 0.34, pointer }, style)
  }

  function frame(now: number): void {
    if (!running) return
    advance(now)
    draw(now)
    raf = requestAnimationFrame(frame)
  }

  function resize(): void {
    const box = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = box.width
    height = box.height
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (!running) draw(performance.now())
  }

  /** Reduced motion: show a finished sentence, the last letter's pose and its final bars. */
  function showStill(text: string): void {
    begin(text)
    doneEl.textContent = text
    idx = text.length
    const last = [...text].reverse().find(isLetter) ?? 'A'
    plan = planLetter(rng, last.toUpperCase())
    order = shuffle(rng, [0, 1, 2, 3])
    showBars(plan.probs, true)
    from = to = cur = LETTERS[plan.letter]
    draw(performance.now())
  }

  function spell(word: string): void {
    const clean = word.replace(/[^a-z]/gi, '').slice(0, MAX_WORD).toLowerCase()
    input.value = ''
    input.hidden = true
    spellBtn.hidden = false
    if (!clean) return
    if (reduce) { showStill(clean); return }
    begin(clean)
    holdUntil = 0
  }

  const onPalette = (): void => { style = readStyle(); if (!running) draw(performance.now()) }
  const onVisibility = (): void => { if (document.hidden) stop(); else start() }
  const onMove = (e: PointerEvent): void => {
    const box = canvas.getBoundingClientRect()
    pointer = [e.clientX - box.left, e.clientY - box.top]
  }
  const onLeave = (): void => { pointer = null }

  function start(): void {
    if (running || reduce || document.hidden) return
    running = true
    raf = requestAnimationFrame(frame)
  }

  function stop(): void {
    running = false
    cancelAnimationFrame(raf)
  }

  return {
    mount(root) {
      el = document.createElement('section')
      el.className = 'landing'
      el.dataset.side = side
      el.innerHTML = `
        <div class="hand">
          <canvas aria-hidden="true"></canvas>
          <p class="cap cap-top">21 landmarks · 63 features</p>
          <p class="cap cap-bot">latency <span class="lat">84</span> ms</p>
        </div>
        <div class="read">
          <div>
            <p class="label">next letter</p>
            <ol class="cands" aria-hidden="true">
              ${'<li><span class="ch"></span><span class="bar"><i></i></span><span class="p"></span></li>'.repeat(4)}
            </ol>
          </div>
          <p class="sentence" aria-hidden="true"><span class="done"></span><span class="tent"></span><span class="caret"></span></p>
          <p class="sr-only" aria-live="polite"></p>
          <p class="status"></p>
          <div class="spell-row">
            <button class="key spell" type="button">spell a word</button>
            <input class="spell-input" type="text" maxlength="${MAX_WORD}" placeholder="type, then enter"
              autocapitalize="off" autocomplete="off" spellcheck="false" aria-label="Word for the hand to spell" hidden />
          </div>
        </div>`
      root.append(el)

      canvas = el.querySelector('canvas')!
      ctx = canvas.getContext('2d')!
      rows = [...el.querySelectorAll<HTMLLIElement>('.cands li')].map((li) => ({
        li,
        ch: li.querySelector<HTMLElement>('.ch')!,
        bar: li.querySelector<HTMLElement>('.bar i')!,
        p: li.querySelector<HTMLElement>('.p')!,
      }))
      doneEl = el.querySelector('.done')!
      tentEl = el.querySelector('.tent')!
      srEl = el.querySelector('.sr-only')!
      latEl = el.querySelector('.lat')!
      el.querySelector('.status')!.textContent = site.status
      spellBtn = el.querySelector('.spell')!
      input = el.querySelector('.spell-input')!

      spellBtn.addEventListener('click', () => {
        spellBtn.hidden = true
        input.hidden = false
        input.focus()
      })
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') spell(input.value)
        else if (e.key === 'Escape') spell('')
        e.stopPropagation()
      })
      input.addEventListener('blur', () => { if (!input.hidden && !input.value) spell('') })

      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerleave', onLeave)
      document.addEventListener('palettechange', onPalette)
      document.addEventListener('visibilitychange', onVisibility)
      observer = new ResizeObserver(resize)
      observer.observe(canvas)
      resize()

      if (reduce) showStill(makeSentence(rng, frames))
      else begin(makeSentence(rng, frames))
    },
    start,
    stop,
    destroy() {
      stop()
      observer?.disconnect()
      document.removeEventListener('palettechange', onPalette)
      document.removeEventListener('visibilitychange', onVisibility)
      el.remove()
    },
  }
}
```

- [ ] **Step 4: Mount it** — append to `src/main.ts`

```ts
import { randomSeed } from './lib/rng'
import { createLanding } from './scenes/landing'

const param = Number(new URLSearchParams(location.search).get('seed'))
const seed = Number.isInteger(param) && param > 0 ? param : randomSeed()
document.getElementById('seed')!.textContent = `seed ${seed}`

const landing = createLanding(seed)
landing.mount(document.getElementById('scene')!)
landing.start()
```

Move the two `import` lines to the top of the file with the other imports.

- [ ] **Step 5: Type-check and test**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all test files pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: landing scene with seeded hand spelling and type-to-spell"
```

---

### Task 10: Browser verification and budget check

**Files:** none new; fixes land in the files above.

- [ ] **Step 1: Desktop check** — `npm run dev`, open at 1280×800.

Confirm each:
- Hand morphs between letter shapes; bars race; chosen row turns green; letters join the serif sentence; a new sentence starts after a pause.
- Reloading shows a different sentence, hand side and tilt. Opening `/?seed=48213` twice shows the same sequence both times.
- A `corrected` letter is visible within a minute: a rival's letter appears in green, then is replaced.
- Moving the pointer near the hand makes nearby points lean toward it.
- "spell a word" → type `hello` → Enter: the hand spells `hello`, then generated sentences resume. Escape closes the input.
- Palette button cycles auto/day/night; hand lines, dots and bars recolor; text stays readable in both.
- Tab away and back: animation pauses and resumes without a jump.

- [ ] **Step 2: Phone check** — resize to 375×812.

Confirm: hand on top, text below, nothing clipped or overlapping, sentence does not push the layout as it grows, the spell button and palette button are easy to tap, no horizontal scroll.

- [ ] **Step 3: Reduced motion** — enable "Reduce motion" in the OS (or emulate in dev tools), reload.

Confirm: a full sentence is shown at once, the hand is still, bars show final values, nothing animates.

- [ ] **Step 4: Budget check**

Run: `npm run build`
Expected: the JS and CSS totals printed by Vite (gzip column) sum to ≤ 70 KB, excluding fonts. Record the numbers in the commit message. If over, remove unused font weights first.

- [ ] **Step 5: Fix what the checks found, rerun `npm test`, commit**

```bash
git add -A && git commit -m "fix: landing scene polish from browser review"
```

---

## Self-review notes

- Spec 3 (tokens, type, accent), 3.2 (time palette, toggle, contrast test): Tasks 3–4. The toggle label is `auto/day/night` text rather than an icon.
- Spec 5.1 (hand, candidates, sentence), 5.1.1 (seed, grammar ≥ 300, rivals, behaviors, hand/layout variation), 5.1.2 (type-to-spell, pointer presence): Tasks 2, 5–9. Type-to-spell opens from a button, not from any key press, so it cannot clash with the navigation keys added in Plan 2; the spec is updated to match.
- Spec 7.2 (pause when hidden, DPR cap, reduced motion, budget): Tasks 9–10.
- Deferred to Plan 2: router, numbered markers, menu, project scenes, content schema validation, `engine/loop`. Deferred to Plan 3: about, resume, computed status line, fallbacks beyond `<noscript>`, security headers, deploy.
