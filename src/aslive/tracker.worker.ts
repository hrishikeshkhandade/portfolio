// Hand tracking in a background thread, so loading and running it never stalls the page.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

type Incoming =
  | { type: 'init'; wasm: string; model: string }
  | { type: 'frame'; bitmap: ImageBitmap; time: number }

const scope = self as unknown as { postMessage(message: unknown): void; onmessage: ((event: MessageEvent<Incoming>) => void) | null }
let tracker: HandLandmarker | null = null

async function create(wasm: string, model: string): Promise<HandLandmarker> {
  const files = await FilesetResolver.forVisionTasks(wasm, true)
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: model, delegate },
    runningMode: 'VIDEO' as const,
    numHands: 1,
    minHandDetectionConfidence: 0.65,
    minTrackingConfidence: 0.5,
  })
  try {
    return await HandLandmarker.createFromOptions(files, options('GPU'))
  } catch {
    return await HandLandmarker.createFromOptions(files, options('CPU'))
  }
}

scope.onmessage = async (event) => {
  const message = event.data
  if (message.type === 'init') {
    try {
      tracker = await create(message.wasm, message.model)
      // The first detection is slow while the model warms up; spend that here, not on the visitor's first frame.
      const blank = new OffscreenCanvas(64, 48)
      blank.getContext('2d')!.fillRect(0, 0, 64, 48)
      tracker.detectForVideo(blank.transferToImageBitmap(), 1)
      scope.postMessage({ type: 'ready' })
    } catch (error) {
      scope.postMessage({ type: 'error', message: String(error) })
    }
    return
  }
  if (!tracker) { message.bitmap.close(); return }
  try {
    const result = tracker.detectForVideo(message.bitmap, message.time)
    scope.postMessage({ type: 'hand', landmarks: result.landmarks[0] ?? null })
  } catch (error) {
    scope.postMessage({ type: 'error', message: String(error) })
  } finally {
    message.bitmap.close()
  }
}
