import type { GithubSettings } from '../github/types'
import { usePromptImages } from '../hooks/usePromptImages'

interface Props {
  promptId: string
  settings: GithubSettings | null
  /** When false, skip network fetch (demo / unconfigured). */
  enabled: boolean
}

/**
 * Card cover: first image with object-fit contain, total count badge.
 * Carousel lives in the detail modal.
 */
export function PromptCover({ promptId, settings, enabled }: Props) {
  const { rootRef, coverUrl, count, status } = usePromptImages(
    promptId,
    settings,
    enabled,
    { lazy: true },
  )

  return (
    <div className="prompt-cover" ref={rootRef}>
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
          {count}张
        </span>
      )}
    </div>
  )
}
