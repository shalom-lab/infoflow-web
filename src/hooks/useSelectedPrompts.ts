import { useCallback, useEffect, useState } from 'react'
import {
  clearSelectedPrompts,
  getAllSelectedPrompts,
  putSelectedPrompt,
  removeSelectedPrompt,
} from '../idb/cache'
import type { PromptItem } from '../types/prompt'

/**
 * Local "cart" of selected prompts, persisted in IndexedDB store
 * `selected-prompts` (full PromptItem rows keyed by prompt_id).
 */
export function useSelectedPrompts() {
  const [selected, setSelected] = useState<PromptItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await getAllSelectedPrompts()
        if (!cancelled) setSelected(rows)
      } catch {
        if (!cancelled) setSelected([])
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const isSelected = useCallback(
    (promptId: string) => selected.some((p) => p.prompt_id === promptId),
    [selected],
  )

  const toggle = useCallback(async (prompt: PromptItem) => {
    const id = prompt.prompt_id
    setSelected((prev) => {
      const exists = prev.some((p) => p.prompt_id === id)
      if (exists) {
        void removeSelectedPrompt(id)
        return prev.filter((p) => p.prompt_id !== id)
      }
      void putSelectedPrompt(prompt)
      return [...prev, prompt]
    })
  }, [])

  const remove = useCallback(async (promptId: string) => {
    await removeSelectedPrompt(promptId)
    setSelected((prev) => prev.filter((p) => p.prompt_id !== promptId))
  }, [])

  const clear = useCallback(async () => {
    await clearSelectedPrompts()
    setSelected([])
  }, [])

  return {
    selected,
    count: selected.length,
    ready,
    isSelected,
    toggle,
    remove,
    clear,
  }
}
