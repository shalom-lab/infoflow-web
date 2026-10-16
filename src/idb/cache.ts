import type { FeaturedMap } from '../types/featured'
import type { PromptItem } from '../types/prompt'

const DB_NAME = 'infoflow-web'
const DB_VERSION = 2
const STORE_PROMPTS = 'prompts'
const STORE_IMAGES = 'images'
const STORE_FEATURED = 'featured'

export type PromptsCacheRecord = {
  /** owner/repo — primary key */
  repo: string
  prompts: PromptItem[]
  /** GitHub Contents file sha */
  sha: string
  /** Optional Contents API ETag for If-None-Match */
  etag: string | null
  updatedAt: string
}

export type ImageCacheRecord = {
  /** `${repo}|${path}` */
  key: string
  repo: string
  path: string
  blob: Blob
  updatedAt: string
}

export type FeaturedCacheRecord = {
  repo: string
  /** prompt_id → featured */
  map: FeaturedMap
  /** Remote file sha when last synced from/to GitHub */
  remoteSha: string | null
  /** Local edits not yet pushed */
  dirty: boolean
  updatedAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_PROMPTS)) {
        db.createObjectStore(STORE_PROMPTS, { keyPath: 'repo' })
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_FEATURED)) {
        db.createObjectStore(STORE_FEATURED, { keyPath: 'repo' })
      }
    }
  })
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb()
  try {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const result = await fn(store)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    return result
  } finally {
    db.close()
  }
}

export function imageCacheKey(repo: string, path: string): string {
  return `${repo.trim()}|${path}`
}

export async function getPromptsCache(
  repo: string,
): Promise<PromptsCacheRecord | null> {
  try {
    return await withStore(STORE_PROMPTS, 'readonly', async (store) => {
      const row = await idbReq(
        store.get(repo.trim()) as IDBRequest<PromptsCacheRecord | undefined>,
      )
      return row ?? null
    })
  } catch {
    return null
  }
}

export async function putPromptsCache(
  record: PromptsCacheRecord,
): Promise<void> {
  await withStore(STORE_PROMPTS, 'readwrite', async (store) => {
    await idbReq(store.put(record))
  })
}

export async function getImageBlob(
  repo: string,
  path: string,
): Promise<Blob | null> {
  try {
    return await withStore(STORE_IMAGES, 'readonly', async (store) => {
      const row = await idbReq(
        store.get(imageCacheKey(repo, path)) as IDBRequest<
          ImageCacheRecord | undefined
        >,
      )
      return row?.blob ?? null
    })
  } catch {
    return null
  }
}

export async function putImageBlob(
  repo: string,
  path: string,
  blob: Blob,
): Promise<void> {
  try {
    const record: ImageCacheRecord = {
      key: imageCacheKey(repo, path),
      repo: repo.trim(),
      path,
      blob,
      updatedAt: new Date().toISOString(),
    }
    await withStore(STORE_IMAGES, 'readwrite', async (store) => {
      await idbReq(store.put(record))
    })
  } catch {
    // Soft-fail — memory cache still works
  }
}

export async function getFeaturedCache(
  repo: string,
): Promise<FeaturedCacheRecord | null> {
  try {
    return await withStore(STORE_FEATURED, 'readonly', async (store) => {
      const row = await idbReq(
        store.get(repo.trim()) as IDBRequest<FeaturedCacheRecord | undefined>,
      )
      return row ?? null
    })
  } catch {
    return null
  }
}

export async function putFeaturedCache(
  record: FeaturedCacheRecord,
): Promise<void> {
  await withStore(STORE_FEATURED, 'readwrite', async (store) => {
    await idbReq(store.put(record))
  })
}

export async function clearPromptsCache(repo?: string): Promise<void> {
  await withStore(STORE_PROMPTS, 'readwrite', async (store) => {
    if (repo?.trim()) await idbReq(store.delete(repo.trim()))
    else await idbReq(store.clear())
  })
}

export async function clearImageCacheStore(repo?: string): Promise<void> {
  await withStore(STORE_IMAGES, 'readwrite', async (store) => {
    if (repo?.trim()) {
      const r = repo.trim()
      const all = await idbReq(store.getAll() as IDBRequest<ImageCacheRecord[]>)
      await Promise.all(
        (all ?? [])
          .filter((row) => row.repo === r)
          .map((row) => idbReq(store.delete(row.key))),
      )
    } else {
      await idbReq(store.clear())
    }
  })
}

export async function clearFeaturedCache(repo?: string): Promise<void> {
  await withStore(STORE_FEATURED, 'readwrite', async (store) => {
    if (repo?.trim()) await idbReq(store.delete(repo.trim()))
    else await idbReq(store.clear())
  })
}

/** Wipe prompts JSON cache + image blobs (+ featured local). */
export async function clearAllLocalCache(): Promise<void> {
  await clearPromptsCache()
  await clearImageCacheStore()
  await clearFeaturedCache()
}

export async function getCacheStats(repo?: string): Promise<{
  hasPrompts: boolean
  promptCount: number
  updatedAt: string | null
  imageCount: number
  featuredCount: number
}> {
  const prompts = repo?.trim() ? await getPromptsCache(repo) : null
  const featured = repo?.trim() ? await getFeaturedCache(repo) : null
  let imageCount = 0
  try {
    imageCount = await withStore(STORE_IMAGES, 'readonly', async (store) => {
      if (repo?.trim()) {
        const all = await idbReq(
          store.getAll() as IDBRequest<ImageCacheRecord[]>,
        )
        return (all ?? []).filter((r) => r.repo === repo.trim()).length
      }
      return await idbReq(store.count())
    })
  } catch {
    imageCount = 0
  }
  const featuredCount = featured
    ? Object.values(featured.map).filter(Boolean).length
    : 0
  return {
    hasPrompts: Boolean(prompts),
    promptCount: prompts?.prompts.length ?? 0,
    updatedAt: prompts?.updatedAt ?? null,
    imageCount,
    featuredCount,
  }
}
