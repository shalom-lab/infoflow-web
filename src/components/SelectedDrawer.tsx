import { useState } from 'react'
import type { PromptItem } from '../types/prompt'
import { ConfirmModal } from './ConfirmModal'

interface Props {
  open: boolean
  items: PromptItem[]
  busy?: boolean
  onClose: () => void
  onRemove: (promptId: string) => void
  onClear: () => void
  onFeature: (ids: string[]) => void | Promise<void>
  onDelete: (ids: string[]) => void | Promise<void>
}

type ConfirmKind = 'feature' | 'delete' | 'clear' | null

export function SelectedDrawer({
  open,
  items,
  busy = false,
  onClose,
  onRemove,
  onClear,
  onFeature,
  onDelete,
}: Props) {
  const [confirm, setConfirm] = useState<ConfirmKind>(null)

  if (!open) return null

  const ids = items.map((p) => p.prompt_id)
  const n = items.length
  const empty = n === 0

  const closeConfirm = () => {
    if (!busy) setConfirm(null)
  }

  const handleConfirm = () => {
    if (confirm === 'feature') {
      void Promise.resolve(onFeature(ids)).finally(() => setConfirm(null))
      return
    }
    if (confirm === 'delete') {
      void Promise.resolve(onDelete(ids)).finally(() => setConfirm(null))
      return
    }
    if (confirm === 'clear') {
      onClear()
      setConfirm(null)
    }
  }

  return (
    <>
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
              <p className="selected-drawer-sub">{n} 条</p>
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
              disabled={empty || busy}
              onClick={() => setConfirm('clear')}
            >
              清空
            </button>
          </div>

          {empty ? (
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
                      disabled={busy}
                      onClick={() => void onRemove(p.prompt_id)}
                    >
                      移除
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <footer className="selected-drawer-footer">
            <button
              type="button"
              className="btn primary"
              disabled={empty || busy}
              onClick={() => setConfirm('feature')}
            >
              精选
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={empty || busy}
              onClick={() => setConfirm('delete')}
            >
              删除
            </button>
          </footer>
        </aside>
      </div>

      <ConfirmModal
        open={confirm === 'feature'}
        title="标为精选"
        message={`将 ${n} 条标为精选并同步到 GitHub？`}
        confirmLabel="标为精选"
        danger={false}
        busy={busy}
        onCancel={closeConfirm}
        onConfirm={handleConfirm}
      />
      <ConfirmModal
        open={confirm === 'delete'}
        title="删除提示词"
        message={`将触发删除工作流，永久删除这 ${n} 条（含效果图）。远程删完需刷新后才反映；确认后也会从本地已选列表移除。`}
        confirmLabel="触发删除"
        danger
        busy={busy}
        onCancel={closeConfirm}
        onConfirm={handleConfirm}
      />
      <ConfirmModal
        open={confirm === 'clear'}
        title="清空已选"
        message={`清空本地已选的 ${n} 条？仅清除本机列表，不影响远程数据。`}
        confirmLabel="清空"
        danger
        busy={busy}
        onCancel={closeConfirm}
        onConfirm={handleConfirm}
      />
    </>
  )
}
