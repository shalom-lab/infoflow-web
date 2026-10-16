import { useState } from 'react'
import type { GithubSettings } from '../github/types'
import type { PromptItem } from '../types/prompt'
import { PromptCover } from './PromptCover'
import { TagCapsule } from './TagCapsule'

interface Props {
  prompt: PromptItem
  settings: GithubSettings | null
  imagesEnabled: boolean
  onKeywordClick: (kw: string) => void
  activeKeyword?: string | null
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

export function PromptCard({
  prompt,
  settings,
  imagesEnabled,
  onKeywordClick,
  activeKeyword,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const title = prompt.wechat_title || prompt.reply_keyword || '(无标题)'
  const preview =
    prompt.content.length > 160
      ? `${prompt.content.slice(0, 160)}…`
      : prompt.content

  const handleCopy = async () => {
    const ok = await copyText(prompt.content)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <article className={`prompt-card${expanded ? ' expanded' : ''}`}>
      <PromptCover
        promptId={prompt.prompt_id}
        settings={settings}
        enabled={imagesEnabled}
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

        <div className="card-prompt">
          <pre className="prompt-text">
            {expanded ? prompt.content : preview}
          </pre>
        </div>

        <div className="card-footer">
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '收起' : '展开全文'}
          </button>
          <button
            type="button"
            className="btn primary sm"
            onClick={() => void handleCopy()}
          >
            {copied ? '已复制' : '复制提示词'}
          </button>
        </div>
      </div>
    </article>
  )
}
