import { useState, type MouseEvent } from 'react'
import type { GithubSettings } from '../github/types'
import { promptImageCount, promptMonth, type PromptItem } from '../types/prompt'
import { copyText } from '../utils/copy'
import { countTierClass } from '../utils/countTier'
import { formatMonthLabel } from './MonthFilter'
import { PromptCover } from './PromptCover'

interface Props {
  prompt: PromptItem
  settings: GithubSettings | null
  imagesEnabled: boolean
  featured: boolean
  onOpenDetail: (prompt: PromptItem) => void
  onToggleFeatured: (promptId: string) => void
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: (prompt: PromptItem) => void
}

export function PromptCard({
  prompt,
  settings,
  imagesEnabled,
  featured,
  onOpenDetail,
  onToggleFeatured,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: Props) {
  const [copied, setCopied] = useState(false)
  const monthYm = promptMonth(prompt)
  const monthLabel = monthYm ? formatMonthLabel(monthYm) : null
  const imgCount = promptImageCount(prompt)
  const tierClass = imgCount > 0 ? countTierClass(imgCount) : ''

  const handleCopy = async (e: MouseEvent) => {
    e.stopPropagation()
    const ok = await copyText(prompt.content)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    }
  }

  const handleStar = (e: MouseEvent) => {
    e.stopPropagation()
    onToggleFeatured(prompt.prompt_id)
  }

  const handleSelectToggle = (e: MouseEvent) => {
    e.stopPropagation()
    onToggleSelect?.(prompt)
  }

  const handlePrimaryClick = () => {
    if (selectMode) {
      onToggleSelect?.(prompt)
      return
    }
    onOpenDetail(prompt)
  }

  return (
    <article
      className={`prompt-card${featured ? ' is-featured' : ''}${
        selectMode && selected ? ' is-selected' : ''
      }${selectMode ? ' select-mode' : ''}${tierClass ? ` ${tierClass}` : ''}`}
    >
      {selectMode && (
        <label
          className="card-select-check"
          title={selected ? '取消选择' : '选择'}
          onClick={handleSelectToggle}
        >
          <input
            type="checkbox"
            checked={selected}
            readOnly
            aria-label={selected ? '取消选择' : '选择此提示词'}
          />
        </label>
      )}

      <PromptCover
        promptId={prompt.prompt_id}
        image={prompt.image}
        images={prompt.images}
        imageCount={prompt.image_count}
        settings={settings}
        enabled={imagesEnabled}
        onClick={handlePrimaryClick}
        hideBadge
      />

      <div
        className="card-meta"
        role={selectMode ? 'button' : undefined}
        tabIndex={selectMode ? 0 : undefined}
        onClick={selectMode ? handlePrimaryClick : undefined}
        onKeyDown={
          selectMode
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handlePrimaryClick()
                }
              }
            : undefined
        }
      >
        {monthLabel && monthYm ? (
          <time className="card-month" dateTime={monthYm}>
            {monthLabel}
          </time>
        ) : (
          <span className="card-month card-month--empty" aria-hidden>
            —
          </span>
        )}
        <div className="card-meta-right">
          {imgCount > 0 && (
            <span
              className={`card-count ${tierClass}`}
              title={`${imgCount} 张效果图`}
            >
              {imgCount}张
            </span>
          )}
          {!selectMode && (
            <div className="card-meta-actions">
              <button
                type="button"
                className={`card-meta-btn${copied ? ' ok' : ''}`}
                title={copied ? '已复制' : '复制提示词'}
                aria-label="复制提示词"
                onClick={(e) => void handleCopy(e)}
              >
                {copied ? '✓' : '⧉'}
              </button>
              <button
                type="button"
                className={`card-meta-btn star${featured ? ' on' : ''}`}
                title={featured ? '取消精选' : '标为精选'}
                aria-label={featured ? '取消精选' : '标为精选'}
                aria-pressed={featured}
                onClick={handleStar}
              >
                {featured ? '★' : '☆'}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
