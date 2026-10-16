import { useEffect, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'warn' | 'info'

export type ToastItem = {
  id: number
  message: string
  kind: ToastKind
}

interface Props {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
  /** Auto-dismiss after ms (default 4200). */
  durationMs?: number
}

function ToastCard({
  item,
  onDismiss,
  durationMs,
}: {
  item: ToastItem
  onDismiss: (id: number) => void
  durationMs: number
}) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t1 = window.setTimeout(() => setLeaving(true), durationMs)
    const t2 = window.setTimeout(() => onDismiss(item.id), durationMs + 320)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [item.id, durationMs, onDismiss])

  return (
    <div
      className={`toast toast-${item.kind}${leaving ? ' leaving' : ''}`}
      role="status"
    >
      <span className="toast-msg">{item.message}</span>
      <button
        type="button"
        className="toast-close"
        aria-label="关闭"
        onClick={() => onDismiss(item.id)}
      >
        ×
      </button>
    </div>
  )
}

export function ToastStack({
  toasts,
  onDismiss,
  durationMs = 4200,
}: Props) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          item={t}
          onDismiss={onDismiss}
          durationMs={durationMs}
        />
      ))}
    </div>
  )
}
