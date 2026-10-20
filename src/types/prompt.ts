export interface PromptItem {
  prompt_id: string
  content: string
  savedAt: string
  wechat_title: string
  keywords: string[]
  reply_keyword?: string
  /** Cover image relative path from source JSON, e.g. ../Images/Prompt/xxx.png */
  image?: string
  /** Gallery image relative paths; keep distinct from `image`. */
  images?: string[]
}

export function normalizePrompts(data: unknown): PromptItem[] {
  if (!Array.isArray(data)) {
    throw new Error('data_all_prompts.json 应为 JSON 数组')
  }
  return data.map((item, index) => {
    const p = item as Partial<PromptItem> & Record<string, unknown>
    const out: PromptItem = {
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
    if (typeof p.image === 'string' && p.image.trim()) {
      out.image = p.image.trim()
    }
    if (Array.isArray(p.images)) {
      out.images = p.images.map(String).filter((s) => s.trim())
    }
    return out
  })
}

/** Convention image path inside the configured private data repo. */
export function imagePathFor(promptId: string, index = 0): string {
  return `infoflow-data/Images/Prompt/${promptId}-${index}.png`
}

/**
 * Map a Prompt JSON relative path to the repo Contents path.
 * Common source form: ../Images/Prompt/foo.png → infoflow-data/Images/Prompt/foo.png
 */
export function resolveImageRepoPath(rel: string): string | null {
  const s = rel.trim().replace(/\\/g, '/')
  if (!s) return null
  const cleaned = s.replace(/^\.\//, '')
  if (cleaned.startsWith('../Images/')) {
    return `infoflow-data/${cleaned.slice(3)}`
  }
  if (cleaned.startsWith('Images/')) {
    return `infoflow-data/${cleaned}`
  }
  if (cleaned.startsWith('infoflow-data/')) {
    return cleaned
  }
  // Bare filename under Prompt images
  if (!cleaned.includes('/') && /\.(png|jpe?g|webp|gif)$/i.test(cleaned)) {
    return `infoflow-data/Images/Prompt/${cleaned}`
  }
  return null
}

/** Ordered gallery repo paths: prefer `images`, else single `image`, else null (caller guesses). */
export function knownImageRepoPaths(
  image?: string,
  images?: string[],
): string[] | null {
  if (images && images.length > 0) {
    const paths = images
      .map(resolveImageRepoPath)
      .filter((p): p is string => Boolean(p))
    return paths.length > 0 ? paths : null
  }
  if (image) {
    const path = resolveImageRepoPath(image)
    return path ? [path] : null
  }
  return null
}
