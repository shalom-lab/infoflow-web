import { useState, type MouseEvent } from 'react'
import type { GithubSettings } from '../github/types'
import type { PromptItem } from '../types/prompt'
import { copyText } from '../utils/copy'
import { PromptCover } from './PromptCover'
import { TagCapsule } from './TagCapsule'

interface Props {
  prompt: PromptItem
  settings: GithubSettings | null
  imagesEnabled: boolean
  featured: boolean
  onKeywordClick: (kw: string) => void
  activeKeyword?: string | null
  onOpenDetail: (prompt: PromptItem) => void
  onToggleFeatured: (promptId: string) => void
}

export function PromptCard({
  prompt,
  settings,
  imagesEnabled,
  featured,
  onKeywordClick,
  activeKeyword,
  onOpenDetail,
  onToggleFeatured,
}: Props) {
  const [copied, setCopied] = useState(false)
  const title = prompt.wechat_title || prompt.reply_keyword || '(无标题)'

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

  return (
    <article className={`prompt-card${featured ? ' is-featured' : ''}`}>
      <PromptCover
        promptId={prompt.prompt_id}
        image={prompt.image}
        images={prompt.images}
        settings={settings}
        enabled={imagesEnabled}
        onClick={() => onOpenDetail(prompt)}
        actions={
          <>
            <button
              type="button"
              className={`cover-action-btn${copied ? ' ok' : ''}`}
              title={copied ? '已复制' : '复制提示词'}
              aria-label="复制提示词"
              onClick={(e) => void handleCopy(e)}
            >
              {copied ? '✓' : '⧉'}
            </button>
            <button
              type="button"
              className={`cover-action-btn star${featured ? ' on' : ''}`}
              title={featured ? '取消精选' : '标为精选'}
              aria-label={featured ? '取消精选' : '标为精选'}
              aria-pressed={featured}
              onClick={handleStar}
            >
              {featured ? '★' : '☆'}
            </button>
          </>
        }
      />

      <div className="card-body">
        <h3 className="card-title" title={title}>
          {title}
        </h3>

        {prompt.keywords.length > 0 && (
          <div className="card-tags">
            {prompt.keywords.map((kw) => (
              <TagCapsule
                key={kw}
                label={kw}
                active={activeKeyword === kw}
                onClick={(e) => {
                  e.stopPropagation()
                  onKeywordClick(kw)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
