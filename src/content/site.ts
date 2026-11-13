import raw from '../../content/site.yaml'
import type { Frame } from '../predict/grammar'

export interface Link { label: string; url: string }
export interface Work { name: string; line: string; stat: string; links: Link[] }

export interface SiteContent {
  wordmark: string
  status: string
  links: Link[]
  work: Work[]
  landing: { frames: Frame[] }
}

export const site = raw as SiteContent
