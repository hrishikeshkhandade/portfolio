import raw from '../../content/how.yaml'

export interface HowSection {
  title: string
  /** Exactly one of these four. */
  steps?: { head: string; body: string }[]
  points?: { head: string; body: string }[]
  list?: string[]
  text?: string[]
}

export interface HowEntry {
  /** Matches a project id in content/site.yaml. */
  id: string
  lede: string
  sections: HowSection[]
}

export const how = raw as HowEntry[]
