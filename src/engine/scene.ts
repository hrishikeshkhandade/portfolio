export interface Scene {
  /** Build DOM inside root. Called once. */
  mount(root: HTMLElement): void
  /** Begin or resume animation. */
  start(): void
  /** Pause animation; keep DOM. */
  stop(): void
  /** Remove DOM and listeners. */
  destroy(): void
}
