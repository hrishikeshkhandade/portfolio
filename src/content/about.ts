import raw from '../../content/about.yaml'

export interface About {
  intro: string
  location: string
  education: { school: string; detail: string; when: string; notes: string[] }[]
  experience: { org: string; role: string; when: string; points: string[] }[]
  projects: { name: string; context: string; when: string; points: string[] }[]
  proof: { value: string; label: string }[]
  honors: string[]
  leadership: string[]
  skills: { label: string; items: string }[]
  certifications: string
}

export const about = raw as About
