import { useEffect, useRef, useState } from 'react'
import { fetchPrivateImage } from '../github/client'
import type { GithubSettings } from '../github/types'
import { imagePathFor } from '../types/prompt'

const MAX_IMAGES = 12

export type ImageLoadStatus = 'idle' | 'loading' | 'ok' | 'empty'

/**
 * Discover consecutive {promptId}-N.png images (stop at first miss).
 * Optional lazy: start when entering viewport; leave cancels in-flight queue work.
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
        const show = entries.some((e) => e.isIntersecting)
        setVisible(show)
      },
      { rootMargin: '160px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [lazy])

  useEffect(() => {
    if (!visible) {
      // Leaving viewport: stop further discovery (queued fetches abort).
      return
    }
    if (!enabled || !settings) {
      setUrls([])
      setStatus('empty')
      return
    }

    const ac = new AbortController()
    let cancelled = false
    setStatus((s) => (s === 'ok' ? s : 'loading'))

    void (async () => {
      const found: string[] = []
      for (let i = 0; i < max; i++) {
        if (cancelled || ac.signal.aborted) return
        const path = imagePathFor(promptId, i)
        const blobUrl = await fetchPrivateImage(settings, path, {
          signal: ac.signal,
        })
        if (cancelled || ac.signal.aborted) return
        if (!blobUrl) break
        found.push(blobUrl)
        setUrls([...found])
        setStatus('ok')
      }
      if (cancelled || ac.signal.aborted) return
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
      ac.abort()
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
