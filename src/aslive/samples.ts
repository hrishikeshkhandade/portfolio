import raw from '../data/aslive-samples.json'

/** One real hand from the ASLive training data, with the model's own top four guesses for it. */
export interface Sample {
  /** 63 values: 21 landmarks as x, y, z relative to the wrist (y grows downward, as in a camera image). */
  points: number[]
  top: [letter: string, probability: number][]
}

export const samples = raw as unknown as Record<string, Sample[]>
