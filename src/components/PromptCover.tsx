import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { fetchPrivateImage } from '../github/client'
import type { GithubSettings } from '../github/types'
import { imagePathFor } from '../types/prompt'

interface Props {
  promptId: string
  settings: GithubSettings | null
  /** When false, skip network fetch (demo / unconfigured). */
  enabled: boolean
}

/**
 * Lazy-load private cover via Contents raw API.
 * Tries {id}-0.png first; carousel discovers -1, -2… on demand.
 */
export function PromptCover({ promptId, settings, enabled }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [index, setIndex] = useState(0)
  const [url, setUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'empty'>(
    'idle',
  )
  const [maxKnown, setMaxKnown] = useState(0)
  const [hasNext, setHasNext] = useState(true)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '120px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !enabled || !settings) {
      if (!enabled) setStatus('empty')
      return
    }
    let cancelled = false
    setStatus('loading')
    const path = imagePathFor(promptId, index)
    void fetchPrivateImage(settings, path).then((blobUrl) => {
      if (cancelled) return
      if (blobUrl) {
        setUrl(blobUrl)
        setStatus('ok')
        setMaxKnown((m) => Math.max(m, index + 1))
      } else if (index === 0) {
        setUrl(null)
        setStatus('empty')
        setHasNext(false)
      } else {
        setHasNext(false)
        setIndex((i) => Math.max(0, i - 1))
      }
    })
    return () => {
      cancelled = true
    }
  }, [visible, enabled, settings, promptId, index])

  const goPrev = (e: MouseEvent) => {
    e.stopPropagation()
    if (index > 0) setIndex((i) => i - 1)
  }

  const goNext = (e: MouseEvent) => {
    e.stopPropagation()
    if (!hasNext && index + 1 >= maxKnown) return
    setIndex((i) => i + 1)
  }

  const showNav = status === 'ok' && (index > 0 || hasNext || maxKnown > 1)

  return (
    <div className="prompt-cover" ref={rootRef}>
      {status === 'ok' && url ? (
        <img src={url} alt="" className="cover-img" loading="lazy" />
      ) : status === 'loading' || status === 'idle' ? (
        <div className="cover-placeholder shimmer" aria-hidden>
          <span>加载中…</span>
        </div>
      ) : (
        <div className="cover-placeholder" aria-hidden>
          <span className="cover-icon">✦</span>
          <span>暂无效果图</span>
        </div>
      )}

      {status === 'ok' && maxKnown > 0 && (
        <span className="cover-badge" title="效果图张数（已发现）">
          {index + 1}
          {hasNext || maxKnown > index + 1 ? '+' : `/${maxKnown}`}
        </span>
      )}

      {showNav && (
        <div className="cover-nav">
          <button
            type="button"
            className="cover-nav-btn"
            disabled={index === 0}
            onClick={goPrev}
            aria-label="上一张"
          >
            ‹
          </button>
          <button
            type="button"
            className="cover-nav-btn"
            disabled={!hasNext && index + 1 >= maxKnown}
            onClick={goNext}
            aria-label="下一张"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
