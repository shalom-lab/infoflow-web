export interface PromptItem {
  prompt_id: string
  content: string
  savedAt: string
  wechat_title: string
  keywords: string[]
  reply_keyword?: string
}

export function normalizePrompts(data: unknown): PromptItem[] {
  if (!Array.isArray(data)) {
    throw new Error('data_all_prompts.json 应为 JSON 数组')
  }
  return data.map((item, index) => {
    const p = item as Partial<PromptItem>
    return {
      prompt_id:
        typeof p.prompt_id === 'string' && p.prompt_id
          ? p.prompt_id
          : `unknown-${index}`,
      content: String(p.content ?? ''),
      savedAt: String(p.savedAt ?? ''),
      wechat_title: String(p.wechat_title ?? ''),
      keywords: Array.isArray(p.keywords) ? p.keywords.map(String) : [],
      reply_keyword:
        p.reply_keyword != null ? String(p.reply_keyword) : undefined,
    }
  })
}

/** Convention image path for private InfoFlow repo. */
export function imagePathFor(promptId: string, index = 0): string {
  return `infoflow-data/Images/Prompt/${promptId}-${index}.png`
}
