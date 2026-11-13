# Portfolio Site — Design Spec

Date: 2026-11-13
Owner: Hrishikesh Khandade
Status: Approved design, awaiting spec review

## 1. Purpose

A personal portfolio that proves, in under a minute, that Hrishikesh ships real AI products.

- **Primary audience:** internship recruiters and engineers screening candidates.
- **Secondary audience:** people who may try the apps (ASLive, Super Scholar, Chef's Fridge).
- **Positioning:** builder who ships AI products. Math research, olympiads and chess are supporting proof, not the lead.
- **Success:** a recruiter lands, is hooked by the opening scene, sees three shipped projects with working pieces and real links, and can reach a resume and LinkedIn in one click.

## 2. Constraints

- Works well on phones and laptops.
- Light on GPU and CPU: no WebGL, no 3D. Canvas 2D and SVG only.
- Easy to change for years: content is separate from code; adding a project requires no code change.
- No phone number and no email address anywhere on the site or in any downloadable file.
- Static site, no backend, no API keys.

## 3. Visual direction — "paper and ink"

A printed research paper that has come alive. Inspired by the quiet, thin-line feel of paradigm.xyz, but with its own identity.

- **Surfaces:** warm off-white paper. No shadows; depth comes from hairlines only.
- **Lines:** 1px ink hairlines; dashed hairlines for guides and bounding boxes.
- **Type:** Newsreader (serif) for the wordmark and sentences; IBM Plex Mono for labels, numbers and navigation. Both self-hosted, subset, `font-display: swap`.
- **Type scale:** ratio 1.25 from a 14px base — 11 / 14 / 18 / 22 / 28 / 44. Large sizes use slightly negative tracking. All numbers use tabular figures.
- **Accent:** one green. It means only "the model chose this" or "this is live". Never decorative.
- **Spacing:** 4px base unit; multiples only.
- **Signature element:** a 21-point hand skeleton paired with a probability list. It appears in the landing scene, the ASLive scene, the loading indicator, the menu mark and the favicon.

### 3.1 Tokens (day keyframe)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F4EFE4` | Page background |
| `--ink` | `#1B1A17` | Text, lines |
| `--ink-soft` | `#6B665B` | Labels, metadata |
| `--ink-faint` | `rgba(27,26,23,0.22)` | Guides, dashed lines |
| `--rule` | `rgba(27,26,23,0.18)` | Borders |
| `--signal` | `#1F7A4D` | Chosen prediction, live state |

All colors live in one theme file. No raw color values elsewhere.

### 3.2 Time-of-day palette

The palette drifts with the visitor's local clock.

- Four keyframes: dawn (06:00), day (12:00), dusk (18:30), night (23:00). Each defines every token above.
- The site interpolates between the two nearest keyframes in OKLCH space, so the hue family stays warm throughout (night is deep warm charcoal with pale paper-colored ink, never blue-black).
- Ink switches between dark-on-light and light-on-dark at a single crossover inside the dusk and dawn transitions.
- Recomputed on load and once a minute. Change is imperceptible minute to minute.
- A toggle cycles auto / day / night. The choice is remembered in `localStorage` (wrapped in try/catch).
- **Guarantee, enforced by test:** at every 10-minute step of the 24-hour cycle, body text contrast is at least 7:1 and label text at least 4.5:1 against the background. The signal green has its own per-keyframe value to stay at least 4.5:1.

## 4. Structure

Full-screen numbered scenes, one at a time.

| # | Scene | Source |
|---|---|---|
| 1 | Hand (landing) | `content/site.yaml` |
| 2…n | One per featured project | `content/projects/*.md` |
| last | About | `content/about.md` |

Scene count is not fixed. Scenes are generated from content.

### 4.1 Navigation

- **Keyboard:** number keys jump to a scene; arrow keys and Page Up/Down step; `M` opens the menu; `R` opens the resume view; `Esc` closes overlays.
- **Pointer:** numbered markers `[1] [2] …` bottom-left; the current one is shown as empty brackets.
- **Scroll / swipe:** wheel and vertical swipe advance one scene, with a threshold and cooldown so one gesture moves one scene.
- **URL:** each scene has a hash (`#aslive`, `#super-scholar`). Deep links and back/forward work.
- **Menu `[M]`:** lists all scenes, archive projects, resume view, LinkedIn, GitHub, palette toggle.
- **Always visible:** wordmark (top center), "resume view" (top left), `[M]` (top right).

### 4.2 Phone layout

- Scenes stack their parts vertically: visual above, text below.
- Swipe changes scene; markers stay bottom-left, large enough to tap (44px hit area).
- Keyboard hints are hidden on touch devices.

## 5. Scenes

### 5.1 Scene 1 — Hand (landing)

A scripted, seeded replay of what ASLive does. No machine-learning model runs here.

**What the visitor sees**

- A line-drawn hand skeleton (21 points, connecting lines) inside a dashed bounding box, with small labels ("21 landmarks · 63 features", a latency readout).
- A "next letter" list: the correct letter plus three rivals, each with a bar and probability.
- A serif sentence that grows one letter at a time as the model "chooses".
- A one-line mono subtitle (current status, see 6.1).

**How it works**

1. **Pose library:** a data file holding, for each letter A–Z, 21 normalized (x, y) points describing the ASL fingerspelling hand shape.
2. **Sentence:** generated from the fragment grammar in `site.yaml` (see 5.1.1).
3. **Per letter (~450–650 ms):** the 21 points tween from the current pose to the next letter's pose; the rival list appears; bars race with slight noise; the winner settles between 0.82 and 0.97 and turns green; the letter is appended to the sentence. Spaces show as a rest pose.
4. **Loop:** after a pause the sentence clears and a new one generates.

**5.1.1 Variation — never the same twice**

Every visit draws a random 5-digit seed (or reads `?seed=` from the URL). A seeded random generator drives:

| Varies | Mechanism |
|---|---|
| Sentence | Grammar: opener × verb × object, built only from fragments listed in `site.yaml`. Every combination must be true and grammatical; fragments carry tags so invalid pairs are excluded. Target: at least 300 valid sentences at launch. |
| Rival letters | Drawn from a table of real ASL confusion sets (for example M/N/S/T, U/V/R, B/F). |
| Model behavior | Per letter: confident, hesitant (bars trade places before settling), or wrong-then-corrected (about 1 letter in 12). |
| Hand | Left or right hand, tilt, per-point jitter, signing speed. |
| Layout | Hand on the left or right of the text (desktop only). |
| Palette | Time of day (3.2). |

The seed is shown small in a corner (`seed 48213`). Opening the same seed replays the same scene.

**5.1.2 Interaction**

- **Type to spell:** pressing a letter key, or tapping "spell a word" on touch devices, lets the visitor enter a word (letters only, max 16); the hand spells it, then the generated sentences resume.
- **Pointer presence:** landmark points lean a few pixels toward a nearby pointer.

### 5.2 Project scenes

Each project scene has the same parts: title, one-line description, two or three stats, a demo, and links. The demo is one of four reusable types chosen in the project's content file.

| Demo type | Behavior | Weight |
|---|---|---|
| `replay` | A scripted line-art animation specific to the project | Light, loads with the scene |
| `iframe` | A poster with a "Play"/"Open" button; on click, loads a live web app in a frame | Heavy part loads only on click |
| `camera` | A button; on click, asks for camera permission and runs in-browser hand tracking | Heavy part loads only on click |
| `gallery` | Screenshots with captions and a click-through | Light |

A project may combine one default demo with one opt-in demo.

**ASLive**

- Default: `replay` — the landmark-to-letter pipeline, reusing the landing hand at smaller scale with pipeline stages labeled (camera → 21 landmarks → Random Forest → letter).
- Opt-in: `camera` — "Try with your camera". Loads MediaPipe Hand Landmarker (web) on click and draws the visitor's own hand skeleton live. Video never leaves the device, and the scene says so.
  - If the trained classifier can be exported from the `aslive` repo to a browser-usable form, the demo also shows predicted letters. If not, it shows the live skeleton only and is labeled as tracking only. This is decided during the build after inspecting the repo; the scene must never imply classification it is not doing.
  - If the camera is denied or unavailable, the scene says so in one line and returns to the replay.
- Stats: 90% classification accuracy; under 100 ms latency; published on two stores.
- Links: Microsoft Store (`https://apps.microsoft.com/detail/9nt9h323f8xv`), App Store (`https://apps.apple.com/in/app/aslive/id6763903531`), research paper (`https://laboffuture.odoo.com/aslive-final-research-paper`), GitHub.
- Note under the store links: "Published under a team developer account; co-developed by Hrishikesh Khandade."

**Super Scholar**

- Default: `replay` — a paper page whose lines break into platforms; a small pixel runner crosses them.
- Opt-in: `iframe` — "Play" loads `https://super-scholar.super-scholar.workers.dev` in a frame. If the frame is blocked by that site's security headers, the button opens the game in a new tab instead. Checked during the build.
- Stats: full game from a 47-page PDF in under a second; runs entirely in the browser; 500 generated levels verified beatable.
- Links: web app, GitHub.

**Chef's Fridge**

- Default: `replay` with a choice — the visitor picks one of three sample fridges; ingredients are tagged one by one with hairline callouts; a recipe types out. Recipes are pre-generated and stored as content. The scene is labeled "sample run".
- Stats: Gemini 2.0 Flash; load time cut 40%; beta tested with 30+ users.
- Links: GitHub.

### 5.3 About scene

- Short paragraph in the site's voice.
- Proof list: parity research (98% accuracy, 10,000+ datasets), olympiad results, chess (Lichess 1750+, 6th of 46 schools at UAE Nationals), GPA 4.00 at UIUC, certifications.
- Contact: LinkedIn and GitHub only.
- A small static hand in the corner spelling "HI".

### 5.4 Resume view

- A plain, single-column, text-first page generated from the same content files.
- Reachable from every scene in one click, and directly at `/resume`.
- "Download PDF" uses a print stylesheet (browser print-to-PDF) so the file always matches the site. No pre-made PDF is hosted.
- Contains no phone number and no email address.
- Fully usable without JavaScript.

## 6. Content model

```
content/
  site.yaml            wordmark, tab title, links, graduation date,
                       landing fragments, confusion sets
  about.md             about paragraph + proof list
  projects/
    aslive.md
    super-scholar.md
    chefs-fridge.md
  poses.json           26 letter poses + rest pose
  theme.yaml           palette keyframes, fonts, scale
public/
  media/<project>/     screenshots, sample fridge images
```

Project file front matter:

```yaml
title: ASLive
slug: aslive
date: 2026-03
featured: true          # featured → own scene; otherwise archive list
order: 1                # optional manual order; else newest first
oneLine: Real-time ASL fingerspelling translator.
stats:
  - { value: "90%", label: "classification accuracy" }
demo: { default: replay, optIn: camera }
links:
  - { label: "Microsoft Store", url: "…" }
note: "Published under a team developer account; …"
```

The body of the file is the longer write-up shown in the resume view and the menu's project detail.

**Rules**

- Content is validated at build time against a schema. A missing required field, an unknown demo type, or a malformed link fails the build with a message naming the file and field.
- Adding a project = adding one file. Scene, number marker, menu entry, URL hash and resume entry appear automatically.
- Non-featured projects appear in an "archive" list in the menu and resume view.

### 6.1 Auto-fresh content

- Status line is computed from the graduation date in `site.yaml` (for example "Freshman, CS at Illinois" → "Sophomore…" after the academic year rolls over). It can be overridden by a manual string.
- "Last updated" is the build date.

## 7. Architecture

- **Stack:** Vite, TypeScript, no UI framework. Canvas 2D for animated scenes, SVG/HTML for text and static line-art.
- **Dependencies (runtime):** none in the initial bundle. MediaPipe Tasks Vision is loaded on demand for the camera demo only.
- **Build:** a small content step reads `content/`, validates it, and emits typed data plus the static resume page.

### 7.1 Modules

| Module | Responsibility | Depends on |
|---|---|---|
| `content/` loader + schema | Read, validate, type the content | — |
| `theme/` | Palette keyframes, interpolation, contrast check, toggle | — |
| `engine/router` | Scene list, current scene, hash sync, keyboard/scroll/swipe input | content |
| `engine/scene` | Scene lifecycle contract: `mount`, `start`, `stop`, `resize`, `destroy` | — |
| `engine/loop` | One shared animation-frame loop; pauses when hidden | — |
| `lib/rng` | Seeded random generator | — |
| `lib/tween` | Easing and interpolation helpers | — |
| `hand/` | Pose data, pose tweening, skeleton drawing | lib |
| `predict/` | Sentence grammar, rival selection, per-letter timeline (pure, no drawing) | lib/rng, content |
| `scenes/landing` | Composes hand + predict + sentence | hand, predict |
| `scenes/project` | Generic project scene; mounts a demo by type | content, demos |
| `demos/*` | `replay-*`, `iframe`, `camera`, `gallery` | hand (some) |
| `scenes/about` | About scene | content |
| `resume/` | Static resume page + print stylesheet | content |

Each scene and each demo is its own lazy-loaded chunk. `predict/` is pure logic so it can be tested without a browser.

### 7.2 Performance rules

- Only the current scene runs; others are stopped and their canvases released.
- The loop pauses when the tab is hidden or the scene is off-screen.
- Canvas resolution is capped at device pixel ratio 2.
- `prefers-reduced-motion`: scenes render a finished static frame; sentences appear whole; palette still follows time of day.
- Heavy assets (camera model, game frame) load only after an explicit click.

**Budgets**

| Metric | Target |
|---|---|
| Initial JS + CSS (gzipped, landing scene) | ≤ 70 KB |
| Fonts (subset, total) | ≤ 90 KB |
| Largest Contentful Paint, mid-range phone on 4G | ≤ 2.0 s |
| Animation | 60 fps on a mid-range phone; no long tasks over 50 ms during a scene |
| Lighthouse performance / accessibility | ≥ 95 / ≥ 95 |

### 7.3 Accessibility

- Every scene has a text equivalent in the DOM (the sentence, project facts and links are real HTML, not canvas-only).
- Full keyboard operation; visible focus rings; overlays trap and return focus.
- Hit areas at least 44×44 px.
- Canvas visuals are marked decorative where the HTML carries the meaning.
- Contrast guaranteed by the palette test (3.2).

### 7.4 Failure handling

| Situation | Behavior |
|---|---|
| JavaScript disabled or fails | Static HTML shows name, project list with links, and the resume view link |
| Canvas unsupported | Same static fallback |
| Camera denied / missing / model fails to load | One-line message; replay continues |
| Game frame blocked or offline | Button opens the game in a new tab |
| Image fails to load | Hairline placeholder box with caption |
| Unknown URL hash | Falls back to scene 1 |
| `localStorage` unavailable | Preferences simply not remembered |

## 8. Testing

- **Unit (Vitest):** seeded generator determinism; sentence grammar produces only valid sentences and at least 300 of them; rival selection never includes the correct letter twice; per-letter timeline timing; palette interpolation and the 24-hour contrast guarantee; content schema accepts valid files and rejects invalid ones; router state transitions.
- **Content test:** adding a fixture project file produces a new scene, marker, menu entry and resume entry.
- **Browser checks (manual, each milestone):** laptop and phone widths, day and night palettes, reduced motion, keyboard-only pass, camera allow and deny paths.
- **Before deploy:** Lighthouse run against the budgets in 7.2; accessibility scan.

## 9. Hosting and deployment

- Cloudflare static hosting, deployed from the GitHub repository on push to `main`.
- Launches on the free `pages.dev`/`workers.dev` address. A custom domain is deferred and can be attached later without code changes.
- Security headers: content security policy allowing self, the fonts (self-hosted), the MediaPipe asset origin and the Super Scholar frame origin; camera permission scoped to self.
- Repository: `~/portfolio`, own git repo. The older project in `~/Websites-Claude` is left untouched.

## 10. Out of scope (for this version)

- Live Gemini calls for Chef's Fridge.
- Chess scene (the older project's engine may be added later as a scene).
- Blog, analytics, contact form.
- Custom domain purchase.

## 11. Inputs still needed from the owner

None block the build; placeholders are used until provided.

- Screenshots or short recordings of each app.
- Three fridge photos for Chef's Fridge samples.
- 10–15 true sentence fragments in his own words for the landing grammar (drafts will be proposed from the resume for approval).
- Whether the ASLive trained model file is available for browser export.

## 12. Build order

1. Scaffold, theme tokens, time-of-day palette with contrast test.
2. Content loader and schema.
3. Engine: scene contract, loop, router, navigation.
4. Landing scene: poses, prediction timeline, seeded variation, type-to-spell.
5. Project scene shell and demo types; ASLive, Super Scholar, Chef's Fridge.
6. About scene, menu, resume view and print layout.
7. Fallbacks, accessibility pass, performance pass.
8. Deploy.

Each step ends with a browser review by the owner before the next begins.
