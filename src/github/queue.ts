/** Tiny concurrency queue for GitHub Contents/raw image fetches. */

const MAX_CONCURRENT = 3

type Job = {
  id: number
  run: () => Promise<void>
  cancelled: boolean
}

let active = 0
let nextId = 1
const waiting: Job[] = []

function pump(): void {
  while (active < MAX_CONCURRENT && waiting.length > 0) {
    const job = waiting.shift()!
    if (job.cancelled) continue
    active++
    void job
      .run()
      .catch(() => {
        /* run() handles its own reject */
      })
      .finally(() => {
        active--
        pump()
      })
  }
}

/**
 * Enqueue an async task. If signal aborts before start, task is skipped.
 * Returns a cancel function for the queued slot.
 */
export function enqueue<T>(
  task: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const controller = new AbortController()
    const onOuterAbort = () => controller.abort()
    if (signal) {
      signal.addEventListener('abort', onOuterAbort, { once: true })
    }

    const job: Job = {
      id: nextId++,
      cancelled: false,
      run: async () => {
        if (job.cancelled || controller.signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        try {
          const value = await task(controller.signal)
          resolve(value)
        } catch (e) {
          reject(e)
        } finally {
          if (signal) signal.removeEventListener('abort', onOuterAbort)
        }
      },
    }

    const cancelWaiting = () => {
      job.cancelled = true
      const idx = waiting.indexOf(job)
      if (idx >= 0) waiting.splice(idx, 1)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    if (signal) {
      signal.addEventListener('abort', cancelWaiting, { once: true })
    }

    waiting.push(job)
    pump()
  })
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = window.setTimeout(() => resolve(), ms)
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}
