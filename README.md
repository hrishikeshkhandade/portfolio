# Portfolio

[![CI](https://github.com/hrishikeshkhandade/portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/hrishikeshkhandade/portfolio/actions/workflows/ci.yml)

**Live: [portfolio.hrishikhandade.workers.dev](https://portfolio.hrishikhandade.workers.dev)**

My personal site. Each project gets its own scene, and where I could, the
scene is a working demo rather than a screenshot.

## What is on it

| Scene | What you can do |
|---|---|
| Landing | A line-drawn hand that signs, plus a box to have it spell a word. |
| ASLive | Turn on your camera and fingerspell. Hand tracking (MediaPipe) and my Random Forest classifier both run in your browser. |
| Super Scholar | Play one small level built into the page, or load the full game in place. |
| Chef's Fridge | Upload a fridge photo and get a recipe from Gemini, through a small server function. |
| Tickbook | Trade against my C++ order book, compiled to WebAssembly, with a live book and trade tape. |
| Parity Formula | Pick digits and compare the formula with a count made by listing every number. |
| About, `/how`, `/resume.html` | Background, one write-up per project, and a printable resume. |

## How it is built

- **No framework.** Vite and TypeScript. Each scene is a small module with
  `mount`, `start`, `stop` and `destroy`, and a hash router swaps them
  (`src/engine/`).
- **Content lives in YAML.** `content/site.yaml` holds the projects, links and
  status line. `content/about.yaml` and `content/how.yaml` hold About, the
  write-ups and the resume. The resume and the write-up pages are generated
  from those files at build time.
- **Hosting.** Cloudflare Workers serves `dist/` as static files. One Worker
  route, `/api/fridge`, forwards a photo to Gemini (`worker/fridge.ts`).
- **Models in the browser.** The ASLive classifier is a 2.7 MB file in
  `public/models/`. The Tickbook engine is `public/wasm/tickbook.wasm`, built
  from [tickbook](https://github.com/hrishikeshkhandade/tickbook).

## Privacy and limits

- The camera demo never uploads video. Frames are read and classified in the
  page.
- The fridge photo is sent to Gemini once to write the recipe and is not
  stored. The request asks Gemini not to store it either (`store: false`).
- The fridge API only accepts requests from this site, and allows 3 tries per
  visitor and 120 in total per day. Counts are kept in Workers KV for two days.
- The page's Content Security Policy (`public/_headers`) allows only the
  outside sources it needs: the MediaPipe files and the Super Scholar game.
- No phone number or email anywhere on the site. Contact is through GitHub
  and LinkedIn.

## Run it

Needs Node 20.19 or newer.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

`npm run build` type-checks and builds to `dist/`. The Vite dev server does
not run the Worker, so the fridge demo falls back to its built-in sample
fridges locally.

## Deploy

```bash
npx wrangler secret put GEMINI_API_KEY
```

```bash
npm run deploy
```

`wrangler.jsonc` names the Cloudflare account and the KV namespace for the
fridge limits.

## Layout

```
content/          site text: projects, About, write-ups, resume
src/engine/       router, stage and the scene interface
src/scenes/       one file per scene
src/aslive/       ASLive classifier and camera loop
src/tickbook/     typed loader for the WebAssembly engine
src/styles/       CSS
worker/           Cloudflare Worker for /api/fridge
public/           headers, model file, wasm, screenshots
tests/            Vitest unit tests
dev/              tools for drawing the share card and the hand
docs/             design spec and build plans
```
