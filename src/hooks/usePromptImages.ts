import { useEffect, useRef, useState } from 'react'
import { fetchPrivateImage } from '../github/client'
import type { GithubSettings } from '../github/types'
import {
  imagePathFor,
  knownImageRepoPaths,
  resolveImageRepoPath,
} from '../types/prompt'

const MAX_IMAGES = 12

export type ImageLoadStatus = 'idle' | 'loading' | 'ok' | 'empty'

export type UsePromptImagesOpts = {
  lazy?: boolean
  max?: number
  /** Cover path from aggregated record (do not conflate with images). */
  image?: string
  /** Gallery paths from aggregated record. */
  images?: string[]
}

/**
 * Load prompt images: prefer recorded `images` / `image`, else probe
 * consecutive {promptId}-N.png until first miss.
 * Optional lazy: start when entering viewport; leave cancels in-flight queue work.
 */
export function usePromptImages(
  promptId: string,
  settings: GithubSettings | null,
  enabled: boolean,
  opts?: UsePromptImagesOpts,
) {
  const lazy = opts?.lazy ?? false
  const max = opts?.max ?? MAX_IMAGES
  const recordImage = opts?.image
  const recordImages = opts?.images
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(!lazy)
  const [urls, setUrls] = useState<string[]>([])
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
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
      setCoverUrl(null)
      setStatus('empty')
      return
    }

    const ac = new AbortController()
    let cancelled = false
    setStatus((s) => (s === 'ok' ? s : 'loading'))

    void (async () => {
      const known = knownImageRepoPaths(recordImage, recordImages)
      const coverPath = recordImage
        ? resolveImageRepoPath(recordImage)
        : null

      const found: string[] = []
      let cover: string | null = null

      const fetchOne = async (path: string): Promise<string | null> => {
        if (cancelled || ac.signal.aborted) return null
        return fetchPrivateImage(settings, path, { signal: ac.signal })
      }

      if (known) {
        for (const path of known.slice(0, max)) {
          const blobUrl = await fetchOne(path)
          if (cancelled || ac.signal.aborted) return
          if (!blobUrl) continue
          found.push(blobUrl)
          if (coverPath && path === coverPath) cover = blobUrl
          setUrls([...found])
          if (cover) setCoverUrl(cover)
          else if (!coverPath) setCoverUrl(found[0] ?? null)
          setStatus('ok')
        }
        // Cover may not be in the first `max` gallery slots — fetch it explicitly.
        if (coverPath && !cover) {
          const blobUrl = await fetchOne(coverPath)
          if (cancelled || ac.signal.aborted) return
          if (blobUrl) {
            cover = blobUrl
            setCoverUrl(cover)
            if (found.length === 0) {
              found.push(blobUrl)
              setUrls([...found])
            }
            setStatus('ok')
          }
        }
        if (!cover && found.length > 0) {
          cover = found[0] ?? null
          setCoverUrl(cover)
        }
      } else {
        for (let i = 0; i < max; i++) {
          const path = imagePathFor(promptId, i)
          const blobUrl = await fetchOne(path)
          if (cancelled || ac.signal.aborted) return
          if (!blobUrl) break
          found.push(blobUrl)
          setUrls([...found])
          setCoverUrl(found[0] ?? null)
          setStatus('ok')
        }
      }

      if (cancelled || ac.signal.aborted) return
      if (found.length === 0 && !cover) {
        setUrls([])
        setCoverUrl(null)
        setStatus('empty')
      } else {
        setUrls(found)
        setCoverUrl(cover ?? found[0] ?? null)
        setStatus('ok')
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [visible, enabled, settings, promptId, max, recordImage, recordImages])

  return {
    rootRef,
    urls,
    count: urls.length,
    coverUrl,
    status,
  }
}
