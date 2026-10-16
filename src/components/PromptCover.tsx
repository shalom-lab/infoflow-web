import type { ReactNode, MouseEvent } from 'react'
import type { GithubSettings } from '../github/types'
import { usePromptImages } from '../hooks/usePromptImages'

interface Props {
  promptId: string
  settings: GithubSettings | null
  /** When false, skip network fetch (demo / unconfigured). */
  enabled: boolean
  onClick?: () => void
  /** Overlay controls (e.g. copy / star), bottom-right. */
  actions?: ReactNode
}

/**
 * Card cover: natural-height image (waterfall-friendly), count badge.
 * Click opens detail; actions stopPropagation.
 */
export function PromptCover({
  promptId,
  settings,
  enabled,
  onClick,
  actions,
}: Props) {
  const { rootRef, coverUrl, count, status } = usePromptImages(
    promptId,
    settings,
    enabled,
    // Cards only need cover (+ few probes for badge); modal loads the rest.
    { lazy: true, max: 3 },
  )

  const clickable = Boolean(onClick)

  return (
    <div
      className={`prompt-cover${clickable ? ' clickable' : ''}`}
      ref={rootRef}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
    >
      {status === 'ok' && coverUrl ? (
        <img src={coverUrl} alt="" className="cover-img" loading="lazy" />
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

      {status === 'ok' && count > 0 && (
        <span className="cover-badge" title={`${count} 张效果图`}>
          {count >= 3 ? `${count}+` : `${count}`}张
        </span>
      )}

      {actions && (
        <div
          className="cover-actions"
          onClick={(e: MouseEvent) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  )
}
