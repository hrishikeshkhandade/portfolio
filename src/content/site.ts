import raw from '../../content/site.yaml'
import type { Frame } from '../predict/grammar'

export interface Link { label: string; url: string }
export interface Work {
  name: string
  /** Present when the project has its own scene; also its address after '#'. */
  id?: string
  line: string
  stat: string
  summary?: string
  stats?: { value: string; label: string }[]
  note?: string
  links: Link[]
  /** Screenshots in public/media/<id>/<file>.png. */
  shots?: { file: string; caption: string }[]
  /** The playable taste of Super Scholar: two facts and one question from a real paper. */
  mini?: {
    paper: string
    facts: { block: string; stomp: string }
    question: { text: string; options: string[]; answer: number; explain: string }
  }
  /** Sample runs for the Chef's Fridge scene. */
  fridges?: Fridge[]
}

export interface Fridge {
  name: string
  items: string[]
  recipe: { title: string; meta: string; steps: string[] }
}

export interface SiteContent {
  wordmark: string
  /** Public address of the site, no trailing slash. */
  url: string
  status: string
  links: Link[]
  work: Work[]
  landing: { frames: Frame[] }
}

export const site = raw as SiteContent
