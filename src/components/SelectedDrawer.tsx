import type { PromptItem } from '../types/prompt'

interface Props {
  open: boolean
  items: PromptItem[]
  onClose: () => void
  onRemove: (promptId: string) => void
  onClear: () => void
}

export function SelectedDrawer({
  open,
  items,
  onClose,
  onRemove,
  onClear,
}: Props) {
  if (!open) return null

  return (
    <div
      className="modal-backdrop cart-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <aside
        className="selected-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="已选提示词"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="selected-drawer-head">
          <div>
            <h2>已选提示词</h2>
            <p className="selected-drawer-sub">{items.length} 条</p>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="selected-drawer-actions">
          <button
            type="button"
            className="btn sm danger"
            disabled={items.length === 0}
            onClick={() => void onClear()}
          >
            清空
          </button>
        </div>

        {items.length === 0 ? (
          <div className="selected-drawer-empty">
            <p>还没有选择提示词</p>
            <p className="hint muted">开启「选择」后点击卡片即可加入</p>
          </div>
        ) : (
          <ul className="selected-drawer-list">
            {items.map((p) => {
              const title = p.wechat_title || p.reply_keyword || '(无标题)'
              return (
                <li key={p.prompt_id} className="selected-drawer-item">
                  <div className="selected-drawer-item-body">
                    <div className="selected-drawer-title" title={title}>
                      {title}
                    </div>
                    {p.keywords.length > 0 && (
                      <div className="selected-drawer-kws">
                        {p.keywords.slice(0, 4).map((kw) => (
                          <span key={kw} className="tag-capsule">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn sm ghost"
                    aria-label={`移除 ${title}`}
                    onClick={() => void onRemove(p.prompt_id)}
                  >
                    移除
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>
    </div>
  )
}
