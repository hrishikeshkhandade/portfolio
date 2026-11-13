export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const easeOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3)
export const smooth = (t: number): number => { const c = clamp01(t); return c * c * (3 - 2 * c) }
