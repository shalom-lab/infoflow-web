import { useEffect, useState, type MouseEvent } from 'react'
import type { GithubSettings } from '../github/types'
import { usePromptImages } from '../hooks/usePromptImages'
import type { PromptItem } from '../types/prompt'
import { copyText } from '../utils/copy'
import {
  copyPromptCardImage,
  downloadPromptCard,
} from '../utils/downloadPromptCard'
import { TagCapsule } from './TagCapsule'

interface Props {
  prompt: PromptItem
  settings: GithubSettings | null
  imagesEnabled: boolean
  onClose: () => void
}

function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 19h14" />
    </svg>
  )
}

/** Copy-image glyph: image frame + small spark (distinct from text copy). */
function CopyImageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <circle cx="9" cy="11" r="1.5" />
      <path d="M3 16l4-4 3 3 2-2 5 5" />
      <path d="M17 3h4v4" />
      <path d="M14 10l7-7" />
    </svg>
  )
}

export function PromptDetailModal({
  prompt,
  settings,
  imagesEnabled,
  onClose,
}: Props) {
  const { urls, count, status, coverUrl } = usePromptImages(
    prompt.prompt_id,
    settings,
    imagesEnabled,
    { lazy: false, image: prompt.image, images: prompt.images },
  )
  const [index, setIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [kwCopied, setKwCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [copyingImage, setCopyingImage] = useState(false)
  const [imageCopied, setImageCopied] = useState(false)

  const title = prompt.wechat_title || prompt.reply_keyword || '(无标题)'
  const replyKeyword = prompt.reply_keyword?.trim() || ''
  const currentUrl = urls[index] ?? null

  useEffect(() => {
    setIndex(0)
    setKwCopied(false)
    setCopied(false)
    setDownloading(false)
    setDownloaded(false)
    setCopyingImage(false)
    setImageCopied(false)
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

  const handleCopyKeyword = async () => {
    if (!replyKeyword) return
    const ok = await copyText(replyKeyword)
    if (ok) {
      setKwCopied(true)
      window.setTimeout(() => setKwCopied(false), 1400)
    }
  }

  const cardOptions = () => ({
    content: prompt.content,
    replyKeyword: replyKeyword || undefined,
    title: prompt.wechat_title?.trim() || undefined,
    keywords: prompt.keywords,
    coverUrl: urls[0] ?? coverUrl ?? undefined,
  })

  const handleDownload = async () => {
    if (downloading || copyingImage) return
    setDownloading(true)
    setDownloaded(false)
    try {
      await downloadPromptCard(cardOptions())
      setDownloaded(true)
      window.setTimeout(() => setDownloaded(false), 1800)
    } catch {
      // Keep silent in-modal; button returns to idle so user can retry
    } finally {
      setDownloading(false)
    }
  }

  const handleCopyImage = async () => {
    if (copyingImage || downloading) return
    setCopyingImage(true)
    setImageCopied(false)
    try {
      const ok = await copyPromptCardImage(cardOptions())
      if (ok) {
        setImageCopied(true)
        window.setTimeout(() => setImageCopied(false), 1800)
      }
    } catch {
      // unsupported / denied — silent
    } finally {
      setCopyingImage(false)
    }
  }

  const copyLabel = copied ? '已复制' : '复制提示词'
  const downloadLabel = downloading
    ? '生成中…'
    : downloaded
      ? '已下载'
      : '下载提示词图片'
  const copyImageLabel = copyingImage
    ? '生成中…'
    : imageCopied
      ? '图片已复制'
      : '复制提示词图片'

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
              <div className="detail-topbar">
                <h2 id="detail-modal-title" className="detail-title">
                  {title}
                </h2>
                {replyKeyword ? (
                  <button
                    type="button"
                    className={`detail-reply-kw${kwCopied ? ' ok' : ''}`}
                    onClick={() => void handleCopyKeyword()}
                    title={kwCopied ? '已复制' : '点击复制口令'}
                    aria-label={
                      kwCopied ? '口令已复制' : `复制口令 ${replyKeyword}`
                    }
                  >
                    {kwCopied ? '已复制' : replyKeyword}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`detail-icon-btn detail-copy-btn${
                    copied ? ' ok' : ''
                  }`}
                  onClick={() => void handleCopy()}
                  title={copyLabel}
                  aria-label={copyLabel}
                >
                  {copied ? '✓' : <CopyIcon />}
                </button>
                <button
                  type="button"
                  className={`detail-icon-btn detail-download-btn${
                    downloaded ? ' ok' : ''
                  }${downloading ? ' busy' : ''}`}
                  onClick={() => void handleDownload()}
                  disabled={downloading || copyingImage}
                  title={downloadLabel}
                  aria-label={downloadLabel}
                >
                  {downloaded ? '✓' : <DownloadIcon />}
                </button>
                <button
                  type="button"
                  className={`detail-icon-btn detail-copy-image-btn${
                    imageCopied ? ' ok' : ''
                  }${copyingImage ? ' busy' : ''}`}
                  onClick={() => void handleCopyImage()}
                  disabled={copyingImage || downloading}
                  title={copyImageLabel}
                  aria-label={copyImageLabel}
                >
                  {imageCopied ? '✓' : <CopyImageIcon />}
                </button>
                <button
                  type="button"
                  className="modal-close detail-close-inline"
                  onClick={onClose}
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>
              {prompt.keywords.length > 0 && (
                <div className="card-tags detail-tags">
                  {prompt.keywords.map((kw) => (
                    <TagCapsule key={kw} label={kw} />
                  ))}
                </div>
              )}
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
