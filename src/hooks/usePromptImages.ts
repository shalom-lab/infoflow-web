import { useEffect, useRef, useState } from 'react'
import { fetchPrivateImage } from '../github/client'
import type { GithubSettings } from '../github/types'
import { imagePathFor } from '../types/prompt'

const MAX_IMAGES = 12

export type ImageLoadStatus = 'idle' | 'loading' | 'ok' | 'empty'

/**
 * Discover consecutive {promptId}-N.png images (stop at first miss).
 * Optional lazy: only start after the root element enters the viewport.
 */
export function usePromptImages(
  promptId: string,
  settings: GithubSettings | null,
  enabled: boolean,
  opts?: { lazy?: boolean; max?: number },
) {
  const lazy = opts?.lazy ?? false
  const max = opts?.max ?? MAX_IMAGES
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(!lazy)
  const [urls, setUrls] = useState<string[]>([])
  const [status, setStatus] = useState<ImageLoadStatus>('idle')

  useEffect(() => {
    if (!lazy) {
      setVisible(true)
      return
    }
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '140px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [lazy])

  useEffect(() => {
    if (!visible) return
    if (!enabled || !settings) {
      setUrls([])
      setStatus('empty')
      return
    }

    let cancelled = false
    setStatus('loading')
    setUrls([])

    void (async () => {
      const found: string[] = []
      for (let i = 0; i < max; i++) {
        if (cancelled) return
        const path = imagePathFor(promptId, i)
        const blobUrl = await fetchPrivateImage(settings, path)
        if (cancelled) return
        if (!blobUrl) break
        found.push(blobUrl)
        // Progressive update so first frame paints early
        setUrls([...found])
        setStatus('ok')
      }
      if (cancelled) return
      if (found.length === 0) {
        setUrls([])
        setStatus('empty')
      } else {
        setUrls(found)
        setStatus('ok')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [visible, enabled, settings, promptId, max])

  return {
    rootRef,
    urls,
    count: urls.length,
    coverUrl: urls[0] ?? null,
    status,
  }
}
