import '@fontsource-variable/newsreader'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './styles/base.css'
import { randomSeed } from './lib/rng'
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

const param = Number(new URLSearchParams(location.search).get('seed'))
const replay = Number.isInteger(param) && param > 0
const seed = replay ? param : randomSeed()
document.getElementById('seed')!.textContent = `seed ${seed}`

const landing = createLanding(seed, replay)
landing.mount(document.getElementById('scene')!)
landing.start()
