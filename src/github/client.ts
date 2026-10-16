import {
  getImageBlob,
  putImageBlob,
  putPromptsCache,
  type PromptsCacheRecord,
} from '../idb/cache'
import { normalizePrompts, type PromptItem } from '../types/prompt'
import {
  DEFAULT_BRANCH,
  GithubApiError,
  parseRepo,
  PROMPTS_PATH,
  type GithubFileContent,
  type GithubSettings,
  type ParsedRepo,
} from './types'

/**
 * Prefer direct browser → api.github.com (GitHub supports CORS).
 * If that fails with a network/CORS error, fall back to the Vite proxy (dev only).
 */
let useProxy = false

function baseUrl(): string {
  return useProxy ? '/api/github' : 'https://api.github.com'
}

function requireRepo(settings: GithubSettings): ParsedRepo {
  const parsed = parseRepo(settings.repo)
  if (!parsed) {
    throw new GithubApiError(422, '仓库格式无效，请使用 owner/repo')
  }
  return parsed
}

async function githubFetch(
  settings: GithubSettings,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${baseUrl()}${path}`
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/vnd.github+json')
  }
  headers.set('Authorization', `Bearer ${settings.token.trim()}`)
  headers.set('X-GitHub-Api-Version', '2022-11-28')
  // Do not set Cache-Control: it is not CORS-safelisted and api.github.com
  // preflight rejects it. Cache bust via query _=timestamp + cache:'no-store'.

  let res: Response
  try {
    res = await fetch(url, { ...init, headers, cache: 'no-store' })
  } catch (networkErr) {
    if (!useProxy && import.meta.env.DEV) {
      useProxy = true
      try {
        return await githubFetch(settings, path, init)
      } catch {
        useProxy = false
        throw networkErr
      }
    }
    throw networkErr
  }

  return res
}

async function parseError(res: Response): Promise<never> {
  let message = res.statusText || 'Unknown error'
  try {
    const body = (await res.json()) as { message?: string }
    if (body.message) message = body.message
  } catch {
    // ignore
  }
  throw new GithubApiError(res.status, message)
}

function decodeBase64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

export type PromptsRemoteResult = {
  prompts: PromptItem[]
  sha: string
  etag: string | null
  /** True when GitHub returned 304 Not Modified */
  notModified: boolean
}

/**
 * Read data/data_all_prompts.json via Contents API.
 * Pass etag for conditional fetch (304 → notModified).
 */
export async function loadPromptsRemote(
  settings: GithubSettings,
  _opts?: { etag?: string | null; force?: boolean },
): Promise<PromptsRemoteResult> {
  const { owner, name } = requireRepo(settings)
  // Bust query only — do NOT send If-None-Match (not CORS-safelisted;
  // api.github.com preflight may reject it). Compare sha client-side instead.
  const bust = `_=${Date.now()}`
  const apiPath = `/repos/${owner}/${name}/contents/${PROMPTS_PATH}?ref=${encodeURIComponent(DEFAULT_BRANCH)}&${bust}`

  const res = await githubFetch(settings, apiPath)

  if (!res.ok) await parseError(res)

  const etag = res.headers.get('ETag')
  const data = (await res.json()) as GithubFileContent
  if (data.encoding !== 'base64' || typeof data.content !== 'string') {
    throw new GithubApiError(422, '无法解码文件内容')
  }
  const text = decodeBase64ToUtf8(data.content)
  const parsed = JSON.parse(text) as unknown
  return {
    prompts: normalizePrompts(parsed),
    sha: data.sha,
    etag,
    notModified: false,
  }
}

/** Persist a successful remote fetch into IndexedDB. */
export async function savePromptsToCache(
  settings: GithubSettings,
  remote: PromptsRemoteResult,
): Promise<PromptsCacheRecord> {
  const record: PromptsCacheRecord = {
    repo: settings.repo.trim(),
    prompts: remote.prompts,
    sha: remote.sha,
    etag: remote.etag,
    updatedAt: new Date().toISOString(),
  }
  await putPromptsCache(record)
  return record
}

export async function testConnection(settings: GithubSettings): Promise<string> {
  const { owner, name } = requireRepo(settings)
  const path = `/repos/${owner}/${name}`
  const res = await githubFetch(settings, path)
  if (!res.ok) await parseError(res)
  const data = (await res.json()) as { full_name: string; private: boolean }
  return `${data.full_name}${data.private ? ' (private)' : ' (public)'}`
}

/** In-memory blob URL cache for private-repo images (session). */
const imageCache = new Map<string, Promise<string | null>>()

function memKey(settings: GithubSettings, path: string): string {
  return `${settings.repo.trim()}|${path}`
}

/**
 * Fetch a private-repo image via Contents API raw + Authorization.
 * Checks IndexedDB blob store, then network; writes IDB on miss.
 * Returns an object URL, or null on 404 / failure.
 */
export function fetchPrivateImage(
  settings: GithubSettings,
  path: string,
): Promise<string | null> {
  const key = memKey(settings, path)
  const hit = imageCache.get(key)
  if (hit) return hit

  const promise = (async (): Promise<string | null> => {
    const repo = settings.repo.trim()
    try {
      const cached = await getImageBlob(repo, path)
      if (cached && cached.size > 0) {
        return URL.createObjectURL(cached)
      }

      const { owner, name } = requireRepo(settings)
      const apiPath = `/repos/${owner}/${name}/contents/${encodeURI(path)}?ref=${encodeURIComponent(DEFAULT_BRANCH)}`
      const res = await githubFetch(settings, apiPath, {
        headers: { Accept: 'application/vnd.github.raw' },
      })
      if (res.status === 404) return null
      if (!res.ok) return null
      const blob = await res.blob()
      if (!blob.size) return null
      void putImageBlob(repo, path, blob)
      return URL.createObjectURL(blob)
    } catch {
      return null
    }
  })()

  imageCache.set(key, promise)
  return promise
}

/** Drop in-memory blob URLs (e.g. after clearing settings/cache). */
export function clearImageCache(): void {
  for (const p of imageCache.values()) {
    void p.then((url) => {
      if (url) URL.revokeObjectURL(url)
    })
  }
  imageCache.clear()
}

/** Load public demo fixture when BYOK is not configured. */
export async function loadDemoPrompts(): Promise<PromptItem[]> {
  const base = import.meta.env.BASE_URL || '/'
  const url = `${base}fixtures/prompts.sample.json`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`无法加载演示数据 (${res.status})`)
  }
  const data = (await res.json()) as unknown
  return normalizePrompts(data)
}
