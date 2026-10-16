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
  onOpenDetail: (prompt: PromptItem) => void
}

export function PromptCard({
  prompt,
  settings,
  imagesEnabled,
  onKeywordClick,
  activeKeyword,
  onOpenDetail,
}: Props) {
  const title = prompt.wechat_title || prompt.reply_keyword || '(无标题)'

  return (
    <article className="prompt-card">
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

        <div className="card-footer">
          <button
            type="button"
            className="btn primary card-detail-btn"
            onClick={() => onOpenDetail(prompt)}
          >
            查看详情
          </button>
        </div>
      </div>
    </article>
  )
}
