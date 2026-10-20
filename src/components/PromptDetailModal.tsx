import { useEffect, useState, type MouseEvent } from 'react'
import type { GithubSettings } from '../github/types'
import { usePromptImages } from '../hooks/usePromptImages'
import type { PromptItem } from '../types/prompt'
import { copyText } from '../utils/copy'
import { TagCapsule } from './TagCapsule'

interface Props {
  prompt: PromptItem
  settings: GithubSettings | null
  imagesEnabled: boolean
  onClose: () => void
}

export function PromptDetailModal({
  prompt,
  settings,
  imagesEnabled,
  onClose,
}: Props) {
  const { urls, count, status } = usePromptImages(
    prompt.prompt_id,
    settings,
    imagesEnabled,
    { lazy: false, image: prompt.image, images: prompt.images },
  )
  const [index, setIndex] = useState(0)
  const [copied, setCopied] = useState(false)

  const title = prompt.wechat_title || prompt.reply_keyword || '(无标题)'
  const currentUrl = urls[index] ?? null

  useEffect(() => {
    setIndex(0)
  }, [prompt.prompt_id])

  useEffect(() => {
    if (index >= urls.length && urls.length > 0) {
      setIndex(urls.length - 1)
    }
  }, [urls.length, index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) setIndex((i) => i - 1)
      if (e.key === 'ArrowRight' && index + 1 < count) setIndex((i) => i + 1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, index, count])

  const handleBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleCopy = async () => {
    const ok = await copyText(prompt.content)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={handleBackdrop}
    >
      <div
        className="detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>

        <div className="detail-layout">
          <div className="detail-media">
            <div className="detail-cover">
              {status === 'ok' && currentUrl ? (
                <img src={currentUrl} alt="" className="detail-img" />
              ) : status === 'loading' || status === 'idle' ? (
                <div className="cover-placeholder shimmer detail-ph" aria-hidden>
                  <span>加载中…</span>
                </div>
              ) : (
                <div className="cover-placeholder detail-ph" aria-hidden>
                  <span className="cover-icon">✦</span>
                  <span>暂无效果图</span>
                </div>
              )}

              {count > 0 && (
                <span className="cover-badge detail-badge">
                  {index + 1}/{count}
                </span>
              )}

              {count > 1 && (
                <div className="cover-nav detail-nav">
                  <button
                    type="button"
                    className="cover-nav-btn"
                    disabled={index === 0}
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    aria-label="上一张"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="cover-nav-btn"
                    disabled={index + 1 >= count}
                    onClick={() =>
                      setIndex((i) => Math.min(count - 1, i + 1))
                    }
                    aria-label="下一张"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="detail-side">
            <div className="detail-side-top">
              <div className="detail-side-meta">
                <h2 id="detail-modal-title" className="detail-title">
                  {title}
                </h2>
                {prompt.keywords.length > 0 && (
                  <div className="card-tags detail-tags">
                    {prompt.keywords.map((kw) => (
                      <TagCapsule key={kw} label={kw} />
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn sm primary detail-copy-btn"
                onClick={() => void handleCopy()}
              >
                {copied ? '已复制' : '复制提示词'}
              </button>
            </div>

            <div className="detail-prompt-wrap">
              <pre className="detail-prompt">{prompt.content}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
