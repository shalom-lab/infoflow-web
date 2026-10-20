import type { ReactNode, MouseEvent } from 'react'
import type { GithubSettings } from '../github/types'
import { usePromptImages } from '../hooks/usePromptImages'
import { promptImageCount } from '../types/prompt'

interface Props {
  promptId: string
  settings: GithubSettings | null
  /** When false, skip network fetch (demo / unconfigured). */
  enabled: boolean
  /** Cover path from record. */
  image?: string
  /** Gallery paths from record. */
  images?: string[]
  /** Aggregate `image_count` when present. */
  imageCount?: number
  onClick?: () => void
  /** Overlay controls (e.g. copy / star), bottom-right. */
  actions?: ReactNode
  /** Hide image-count badge on cover (card meta row shows it instead). */
  hideBadge?: boolean
}

/**
 * Card cover: natural-height image (waterfall-friendly), count badge.
 * Click opens detail; actions stopPropagation.
 */
export function PromptCover({
  promptId,
  settings,
  enabled,
  image,
  images,
  imageCount,
  onClick,
  actions,
  hideBadge = false,
}: Props) {
  const declaredCount = promptImageCount({
    image_count: imageCount,
    image,
    images,
  })
  const { rootRef, coverUrl, count, status } = usePromptImages(
    promptId,
    settings,
    enabled,
    // Cards only need cover (+ few probes); badge uses declared count.
    { lazy: true, max: 3, image, images },
  )

  // Prefer summary count; fall back to loaded URLs only when undeclared.
  const badgeCount = declaredCount > 0 ? declaredCount : count
  const showBadge = badgeCount > 0 && (declaredCount > 0 || status === 'ok')

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
      {/* Prefer cached coverUrl even before status flips — avoids filter remount flash. */}
      {coverUrl ? (
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

      {!hideBadge && showBadge && (
        <span className="cover-badge" title={`${badgeCount} 张效果图`}>
          {badgeCount}张
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
