import '@fontsource-variable/newsreader'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './styles/base.css'
import './styles/landing.css'
import { site } from './content/site'
import { randomSeed } from './lib/rng'
import { createStage, type SceneDef } from './engine/stage'
import { createLanding } from './scenes/landing'
import { cycleMode, getMode, startPalette } from './theme/apply'

startPalette()

const modeBtn = document.getElementById('mode') as HTMLButtonElement
const showMode = (m: string) => {
  modeBtn.textContent = m
  modeBtn.setAttribute('aria-label', `Change palette: ${m}`)
}
showMode(getMode())
modeBtn.addEventListener('click', () => showMode(cycleMode()))

const linksEl = document.getElementById('links')!
for (const link of site.links) {
  const a = document.createElement('a')
  a.href = link.url
  a.target = '_blank'
  a.rel = 'noopener'
  a.textContent = link.label
  linksEl.append(a)
}

const param = Number(new URLSearchParams(location.search).get('seed'))
const replay = Number.isInteger(param) && param > 0
const seed = replay ? param : randomSeed()
document.getElementById('seed')!.textContent = `seed ${seed}`

const scenes: SceneDef[] = [
  { id: 'hand', title: 'Hand', load: () => createLanding(seed, replay, (id) => stage.go(id)) },
  { id: 'aslive', title: 'ASLive', load: async () => (await import('./scenes/aslive')).createAslive() },
]
const stage = createStage(document.getElementById('scene')!, document.getElementById('markers')!, scenes, document.title)
