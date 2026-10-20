import { useEffect, useRef, useState } from 'react'
import {
  fetchPrivateImage,
  peekCachedImageMiss,
  peekCachedImageUrl,
  peekPromptCoverUrl,
  rememberPromptCoverUrl,
} from '../github/client'
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

type PeekResult = {
  urls: string[]
  coverUrl: string | null
  status: ImageLoadStatus
  /** True when every path we would request is already in the session Map. */
  complete: boolean
}

/**
 * Sync read of session caches so filter remounts paint the cover immediately
 * (no "加载中…" flash, no GitHub re-fetch for paths already in memory).
 */
function peekFromSessionCache(
  promptId: string,
  settings: GithubSettings | null,
  enabled: boolean,
  max: number,
  recordImage?: string,
  recordImages?: string[],
): PeekResult {
  if (!enabled || !settings) {
    return { urls: [], coverUrl: null, status: 'empty', complete: true }
  }

  const remembered = peekPromptCoverUrl(settings, promptId)
  const known = knownImageRepoPaths(recordImage, recordImages)
  const coverPath = recordImage ? resolveImageRepoPath(recordImage) : null
  const found: string[] = []
  let cover: string | null = remembered
  let complete = false

  if (known) {
    const slice = known.slice(0, max)
    let allHit = true
    for (const path of slice) {
      const url = peekCachedImageUrl(settings, path)
      if (!url) {
        allHit = false
        continue
      }
      found.push(url)
      if (coverPath && path === coverPath) cover = url
    }
    if (coverPath && !cover) {
      const c = peekCachedImageUrl(settings, coverPath)
      if (c) cover = c
      else allHit = false
    }
    if (!cover && found.length > 0) cover = found[0] ?? null
    // complete only if every requested gallery slot (+ cover) hit memory
    complete = allHit && slice.length > 0
    if (coverPath && !peekCachedImageUrl(settings, coverPath)) complete = false
  } else {
    // Probe mode: consecutive hits; complete at max or when next index is a known 404.
    for (let i = 0; i < max; i++) {
      const path = imagePathFor(promptId, i)
      const url = peekCachedImageUrl(settings, path)
      if (url) {
        found.push(url)
        continue
      }
      if (peekCachedImageMiss(settings, path)) complete = true
      break
    }
    if (!cover) cover = found[0] ?? null
    if (found.length >= max) complete = true
  }

  if (cover || found.length > 0) {
    return {
      urls: found.length > 0 ? found : cover ? [cover] : [],
      coverUrl: cover ?? found[0] ?? null,
      status: 'ok',
      complete,
    }
  }
  return { urls: [], coverUrl: null, status: 'idle', complete: false }
}

/**
 * Load prompt images: prefer recorded `images` / `image`, else probe
 * consecutive {promptId}-N.png until first miss.
 * Optional lazy: start when entering viewport; leave cancels in-flight queue work.
 * Session caches survive unmount — filter remounts reuse objectURLs without network.
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
  const recordImagesKey = recordImages?.join('\0') ?? ''
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(!lazy)

  const initial = peekFromSessionCache(
    promptId,
    settings,
    enabled,
    max,
    recordImage,
    recordImages,
  )
  const [urls, setUrls] = useState<string[]>(initial.urls)
  const [coverUrl, setCoverUrl] = useState<string | null>(initial.coverUrl)
  const [status, setStatus] = useState<ImageLoadStatus>(initial.status)

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
    const peeked = peekFromSessionCache(
      promptId,
      settings,
      enabled,
      max,
      recordImage,
      recordImages,
    )
    if (peeked.status === 'ok') {
      setUrls(peeked.urls)
      setCoverUrl(peeked.coverUrl)
      setStatus('ok')
      if (peeked.coverUrl && settings) {
        rememberPromptCoverUrl(settings, promptId, peeked.coverUrl)
      }
      // All needed paths already in session Map — skip network entirely.
      if (peeked.complete) return
    }

    if (!visible) {
      // Keep coverUrl/status; only cancel in-flight via cleanup when leaving.
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
    setStatus((s) => (s === 'ok' || peeked.status === 'ok' ? 'ok' : 'loading'))

    void (async () => {
      const known = knownImageRepoPaths(recordImage, recordImages)
      const coverPath = recordImage
        ? resolveImageRepoPath(recordImage)
        : null

      const found: string[] = []
      let cover: string | null = null

      const fetchOne = async (path: string): Promise<string | null> => {
        if (cancelled || ac.signal.aborted) return null
        const mem = peekCachedImageUrl(settings, path)
        if (mem) return mem
        return fetchPrivateImage(settings, path, { signal: ac.signal })
      }

      const applyCover = (url: string | null) => {
        if (!url) return
        cover = url
        setCoverUrl(url)
        rememberPromptCoverUrl(settings, promptId, url)
      }

      if (known) {
        for (const path of known.slice(0, max)) {
          const blobUrl = await fetchOne(path)
          if (cancelled || ac.signal.aborted) return
          if (!blobUrl) continue
          found.push(blobUrl)
          if (coverPath && path === coverPath) applyCover(blobUrl)
          setUrls([...found])
          if (!coverPath) applyCover(found[0] ?? null)
          setStatus('ok')
        }
        if (coverPath && !cover) {
          const blobUrl = await fetchOne(coverPath)
          if (cancelled || ac.signal.aborted) return
          if (blobUrl) {
            applyCover(blobUrl)
            if (found.length === 0) {
              found.push(blobUrl)
              setUrls([...found])
            }
            setStatus('ok')
          }
        }
        if (!cover && found.length > 0) applyCover(found[0] ?? null)
      } else {
        for (let i = 0; i < max; i++) {
          const path = imagePathFor(promptId, i)
          const blobUrl = await fetchOne(path)
          if (cancelled || ac.signal.aborted) return
          if (!blobUrl) break
          found.push(blobUrl)
          setUrls([...found])
          applyCover(found[0] ?? null)
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
        applyCover(cover ?? found[0] ?? null)
        setStatus('ok')
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
      // Do NOT revoke objectURLs — session cache keeps them for remounts.
    }
  }, [
    visible,
    enabled,
    settings,
    promptId,
    max,
    recordImage,
    recordImagesKey,
    recordImages,
  ])

  return {
    rootRef,
    urls,
    count: urls.length,
    coverUrl,
    status,
  }
}
