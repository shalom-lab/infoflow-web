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
  /** Aggregate summary count of local effect images (preferred for badge/filter). */
  image_count?: number
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
    const rawCount = (item as Record<string, unknown>).image_count
    if (typeof rawCount === 'number' && Number.isFinite(rawCount) && rawCount >= 0) {
      out.image_count = Math.floor(rawCount)
    } else if (typeof rawCount === 'string' && rawCount.trim() !== '') {
      const n = Number(rawCount)
      if (Number.isFinite(n) && n >= 0) out.image_count = Math.floor(n)
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
    const seen = new Set<string>()
    const paths: string[] = []
    for (const rel of images) {
      const p = resolveImageRepoPath(rel)
      if (!p || seen.has(p)) continue
      seen.add(p)
      paths.push(p)
    }
    return paths.length > 0 ? paths : null
  }
  if (image) {
    const path = resolveImageRepoPath(image)
    return path ? [path] : null
  }
  return null
}

/** YYYY-MM from savedAt, or prompt_id time prefix as fallback. */
export function promptMonth(p: PromptItem): string | null {
  const fromSaved = String(p.savedAt ?? '').match(/^(\d{4}-\d{2})/)
  if (fromSaved) return fromSaved[1]
  const fromId = String(p.prompt_id ?? '').match(/^(\d{4}-\d{2})/)
  if (fromId) return fromId[1]
  return null
}

/**
 * Declared gallery size for badge/filter.
 * Prefer aggregate `image_count` when present, but never exceed the unique
 * recorded `images` list (guards against a inflated summary count).
 */
export function promptImageCount(p: {
  image_count?: number
  image?: string
  images?: string[]
}): number {
  const known = knownImageRepoPaths(p.image, p.images)
  const listLen = known?.length ?? 0

  if (
    typeof p.image_count === 'number' &&
    Number.isFinite(p.image_count) &&
    p.image_count >= 0
  ) {
    const declared = Math.floor(p.image_count)
    if (listLen > 0) return Math.min(declared, listLen)
    return declared
  }
  if (listLen > 0) return listLen
  if (p.image && p.image.trim()) return 1
  return 0
}
