/**
 * The ASLive classifier, ported to run in a browser: the same Random Forest and feature scaling
 * the desktop app uses, read from the binary file written by tools/export_aslive.py.
 */
export interface Forest {
  classes: string[]
  trees: number
  /** Class probabilities for one hand, in the order of `classes`. Input is 63 normalized values. */
  predict(features: ArrayLike<number>): Float32Array
}

interface Header {
  classes: string[]
  features: number
  trees: number
  nodes: number
  leaves: number
  starts: number[]
  mean: number[]
  scale: number[]
}

export function parseForest(buffer: ArrayBuffer): Forest {
  const view = new DataView(buffer)
  const headerLength = view.getUint32(0, true)
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength))) as Header
  let offset = 4 + headerLength
  offset += (4 - (offset % 4)) % 4
  const { nodes, leaves, classes, features, trees, starts, mean, scale } = header
  const k = classes.length
  const expected = offset + nodes * 4 + nodes * 4 + nodes + leaves * k
  if (buffer.byteLength !== expected) throw new Error('Model file is incomplete')

  const threshold = new Float32Array(buffer, offset, nodes); offset += nodes * 4
  // For a split node: index of its right child (the left child is the next node). For a leaf: its row in `leaf`.
  const link = new Uint32Array(buffer, offset, nodes); offset += nodes * 4
  const feature = new Int8Array(buffer, offset, nodes); offset += nodes
  const leaf = new Uint8Array(buffer, offset, leaves * k)
  const scaled = new Float32Array(features)

  return {
    classes,
    trees,
    predict(input) {
      if (input.length !== features) throw new Error(`Expected ${features} values, got ${input.length}`)
      for (let i = 0; i < features; i++) scaled[i] = (input[i] - mean[i]) / scale[i]
      const out = new Float32Array(k)
      for (let t = 0; t < trees; t++) {
        let node = starts[t]
        while (feature[node] >= 0) node = scaled[feature[node]] <= threshold[node] ? node + 1 : link[node]
        const row = link[node] * k
        let sum = 0
        for (let c = 0; c < k; c++) sum += leaf[row + c]
        for (let c = 0; c < k; c++) out[c] += leaf[row + c] / sum
      }
      for (let c = 0; c < k; c++) out[c] /= trees
      return out
    },
  }
}

export interface Landmark { x: number; y: number; z: number }

/**
 * Turns 21 hand landmarks into the 63 values the model was trained on: positions relative to the
 * wrist, divided by the wrist-to-middle-fingertip distance. Mirrors `normalize_landmarks` in the app.
 */
export function normalizeLandmarks(points: Landmark[]): number[] {
  const wrist = points[0]
  const centered = points.map((p) => [p.x - wrist.x, p.y - wrist.y, p.z - wrist.z])
  const size = Math.hypot(centered[12][0], centered[12][1], centered[12][2]) || 1
  return centered.flatMap((p) => [p[0] / size, p[1] / size, p[2] / size])
}

/** Indices of the highest values, best first. */
export function topK(probabilities: ArrayLike<number>, count: number): number[] {
  return Array.from({ length: probabilities.length }, (_, i) => i)
    .sort((a, b) => probabilities[b] - probabilities[a])
    .slice(0, count)
}
