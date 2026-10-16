/**
 * Remote file shape for data/prompt_featured.json:
 * { "featured": { "<prompt_id>": true, ... } }
 * Also accepts a flat map { "<prompt_id>": true } when reading.
 */
export type FeaturedMap = Record<string, boolean>

export type FeaturedFile = {
  featured: FeaturedMap
}

export function parseFeaturedFile(data: unknown): FeaturedMap {
  if (!data || typeof data !== 'object') return {}
  const obj = data as Record<string, unknown>
  if (obj.featured && typeof obj.featured === 'object' && !Array.isArray(obj.featured)) {
    return normalizeMap(obj.featured as Record<string, unknown>)
  }
  // flat map fallback
  return normalizeMap(obj)
}

function normalizeMap(raw: Record<string, unknown>): FeaturedMap {
  const out: FeaturedMap = {}
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'featured') continue
    if (v === true) out[k] = true
  }
  return out
}

export function toFeaturedFile(map: FeaturedMap): FeaturedFile {
  const featured: FeaturedMap = {}
  for (const [k, v] of Object.entries(map)) {
    if (v) featured[k] = true
  }
  return { featured }
}
