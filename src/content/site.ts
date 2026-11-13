import raw from '../../content/site.yaml'
import type { Frame } from '../predict/grammar'

export interface SiteContent {
  wordmark: string
  status: string
  links: { label: string; url: string }[]
  landing: { frames: Frame[] }
}

export const site = raw as SiteContent
