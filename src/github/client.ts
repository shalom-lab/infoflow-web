import {
  getImageBlob,
  putImageBlob,
  putPromptsCache,
  type PromptsCacheRecord,
} from '../idb/cache'
import {
  parseFeaturedFile,
  toFeaturedFile,
  type FeaturedMap,
} from '../types/featured'
import { normalizePrompts, type PromptItem } from '../types/prompt'
import { enqueue, sleep } from './queue'
import {
  DEFAULT_BRANCH,
  FEATURED_PATH,
  GithubApiError,
  isRateLimitHint,
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
  const rateLimited =
    res.status === 429 || isRateLimitHint(res, message) || (res.status === 403 && isRateLimitHint(res, message))
  throw new GithubApiError(res.status, message, rateLimited)
}

function decodeBase64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

function encodeUtf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}
/**
 * Resolve UTF-8 text from Contents API metadata.
 * Files >1MB omit base64 `content` (encoding often "none"); fall back to
 * download_url (preferred) then git blobs API.
 */
async function resolveFileText(
  settings: GithubSettings,
  data: GithubFileContent,
  label: string,
): Promise<string> {
  if (
    data.encoding === 'base64' &&
    typeof data.content === 'string' &&
    data.content.length > 0
  ) {
    return decodeBase64ToUtf8(data.content)
  }

  const { owner, name } = requireRepo(settings)
  let lastDetail = '无可用备用通道'

  // Prefer download_url — simple raw text, works with same Authorization.
  if (data.download_url) {
    try {
      const headers = new Headers()
      headers.set('Authorization', `Bearer ${settings.token.trim()}`)
      // raw.githubusercontent.com: avoid non-CORS-safelisted Accept when possible
      const res = await fetch(data.download_url, {
        headers,
        cache: 'no-store',
      })
      if (res.ok) {
        return await res.text()
      }
      lastDetail = `download_url HTTP ${res.status}`
    } catch (e) {
      lastDetail =
        e instanceof Error ? `download_url: ${e.message}` : 'download_url 网络错误'
    }
  }

  // Blob API supports larger files (base64 up to ~100MB).
  if (data.sha) {
    try {
      const blobPath = `/repos/${owner}/${name}/git/blobs/${data.sha}`
      const res = await githubFetch(settings, blobPath)
      if (!res.ok) await parseError(res)
      const blob = (await res.json()) as { content?: string; encoding?: string }
      if (
        blob.encoding === 'base64' &&
        typeof blob.content === 'string' &&
        blob.content.length > 0
      ) {
        return decodeBase64ToUtf8(blob.content)
      }
      lastDetail = 'git/blobs 未返回 base64 content'
    } catch (e) {
      if (e instanceof GithubApiError) throw e
      lastDetail =
        e instanceof Error ? `git/blobs: ${e.message}` : 'git/blobs 失败'
    }
  }

  throw new GithubApiError(
    422,
    `文件过大改用备用通道失败（${label}）：${lastDetail}`,
  )
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
  if (!data.sha) {
    throw new GithubApiError(422, '无法解码文件内容：缺少 sha')
  }
  const text = await resolveFileText(settings, data, PROMPTS_PATH)
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

/** Successful object URLs (session). */
const imageUrlCache = new Map<string, string>()
/** Definitive 404 misses (session). */
const imageMissCache = new Set<string>()
/** In-flight network/IDB lookups. */
const imageInflight = new Map<string, Promise<string | null>>()

function memKey(settings: GithubSettings, path: string): string {
  return `${settings.repo.trim()}|${path}`
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === 'AbortError') ||
    (e instanceof Error && e.name === 'AbortError')
  )
}

const IMAGE_MAX_RETRIES = 4

async function fetchImageNetwork(
  settings: GithubSettings,
  path: string,
  signal: AbortSignal,
): Promise<Blob | null> {
  const { owner, name } = requireRepo(settings)
  const apiPath = `/repos/${owner}/${name}/contents/${encodeURI(path)}?ref=${encodeURIComponent(DEFAULT_BRANCH)}`

  let attempt = 0
  while (attempt <= IMAGE_MAX_RETRIES) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const res = await githubFetch(settings, apiPath, {
      headers: { Accept: 'application/vnd.github.raw' },
      signal,
    })
    if (res.status === 404) return null
    if (res.ok) {
      const blob = await res.blob()
      return blob.size > 0 ? blob : null
    }

    let message = res.statusText || ''
    try {
      const body = (await res.clone().json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      // ignore
    }
    const rateLimited =
      res.status === 429 || isRateLimitHint(res, message)

    if ((rateLimited || res.status === 403 || res.status === 502 || res.status === 503) && attempt < IMAGE_MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('retry-after') || '')
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(16000, 500 * 2 ** attempt) + Math.random() * 200
      attempt++
      await sleep(backoff, signal)
      continue
    }

    // Soft-fail for images — avoid toast spam from masonry
    return null
  }
  return null
}

export type FetchPrivateImageOpts = {
  signal?: AbortSignal
}

/**
 * Fetch a private-repo image via Contents API raw + Authorization.
 * IDB first (no queue); network goes through a global concurrency queue
 * with exponential backoff on rate limits.
 */
export function fetchPrivateImage(
  settings: GithubSettings,
  path: string,
  opts?: FetchPrivateImageOpts,
): Promise<string | null> {
  const key = memKey(settings, path)
  const signal = opts?.signal

  if (signal?.aborted) return Promise.resolve(null)

  const hitUrl = imageUrlCache.get(key)
  if (hitUrl) return Promise.resolve(hitUrl)
  if (imageMissCache.has(key)) return Promise.resolve(null)

  const inflight = imageInflight.get(key)
  if (inflight) {
    // Share in-flight; still honor caller abort by racing
    if (!signal) return inflight
    return new Promise((resolve) => {
      let settled = false
      const onAbort = () => {
        if (!settled) {
          settled = true
          resolve(null)
        }
      }
      signal.addEventListener('abort', onAbort, { once: true })
      void inflight.then((url) => {
        if (!settled) {
          settled = true
          signal.removeEventListener('abort', onAbort)
          resolve(signal.aborted ? null : url)
        }
      })
    })
  }

  const promise = (async (): Promise<string | null> => {
    const repo = settings.repo.trim()
    try {
      // IndexedDB — outside rate-limit queue
      const cached = await getImageBlob(repo, path)
      if (signal?.aborted) return null
      if (cached && cached.size > 0) {
        const url = URL.createObjectURL(cached)
        imageUrlCache.set(key, url)
        return url
      }

      // Network — queued + retries
      const blob = await enqueue(
        (queueSignal) => fetchImageNetwork(settings, path, queueSignal),
        signal,
      )
      if (!blob) {
        imageMissCache.add(key)
        return null
      }
      void putImageBlob(repo, path, blob)
      const url = URL.createObjectURL(blob)
      imageUrlCache.set(key, url)
      return url
    } catch (e) {
      if (isAbortError(e)) return null
      return null
    } finally {
      imageInflight.delete(key)
    }
  })()

  imageInflight.set(key, promise)
  return promise
}

/** Drop in-memory blob URLs (e.g. after clearing settings/cache). */
export function clearImageCache(): void {
  for (const url of imageUrlCache.values()) {
    URL.revokeObjectURL(url)
  }
  imageUrlCache.clear()
  imageMissCache.clear()
  imageInflight.clear()
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

export type FeaturedRemoteResult = {
  map: FeaturedMap
  sha: string | null
}

/** Load data/prompt_featured.json; missing file → empty map (no throw). */
export async function loadFeaturedRemote(
  settings: GithubSettings,
): Promise<FeaturedRemoteResult> {
  const { owner, name } = requireRepo(settings)
  const bust = `_=${Date.now()}`
  const apiPath = `/repos/${owner}/${name}/contents/${FEATURED_PATH}?ref=${encodeURIComponent(DEFAULT_BRANCH)}&${bust}`
  const res = await githubFetch(settings, apiPath)
  // File not created yet — silent empty. Do not toast.
  if (res.status === 404) {
    return { map: {}, sha: null }
  }
  if (!res.ok) {
    // Some gateways surface missing private paths oddly; only soft-handle true Not Found.
    try {
      const body = (await res.clone().json()) as { message?: string }
      if (/not found/i.test(body.message ?? '')) {
        return { map: {}, sha: null }
      }
    } catch {
      // ignore parse
    }
    await parseError(res)
  }
  const data = (await res.json()) as GithubFileContent
  if (!data.sha) {
    throw new GithubApiError(422, '无法解码精选文件：缺少 sha')
  }
  const text = await resolveFileText(settings, data, FEATURED_PATH)
  let parsed: unknown = {}
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    parsed = {}
  }
  return { map: parseFeaturedFile(parsed), sha: data.sha }
}

/**
 * Write featured side-channel JSON (RMW with sha).
 * Creates the file when sha is null.
 */
export async function saveFeaturedRemote(
  settings: GithubSettings,
  map: FeaturedMap,
  sha: string | null,
): Promise<{ sha: string }> {
  const { owner, name } = requireRepo(settings)
  const apiPath = `/repos/${owner}/${name}/contents/${FEATURED_PATH}`
  const bodyObj = toFeaturedFile(map)
  const contentText = `${JSON.stringify(bodyObj, null, 2)}\n`
  const body: Record<string, string> = {
    message: 'chore: update prompt featured map',
    content: encodeUtf8ToBase64(contentText),
    branch: DEFAULT_BRANCH,
  }
  if (sha) body.sha = sha

  const res = await githubFetch(settings, apiPath, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) await parseError(res)
  const data = (await res.json()) as { content: { sha: string } }
  return { sha: data.content.sha }
}
