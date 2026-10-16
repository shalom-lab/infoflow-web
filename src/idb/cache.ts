import type { PromptItem } from '../types/prompt'

const DB_NAME = 'infoflow-web'
const DB_VERSION = 1
const STORE_PROMPTS = 'prompts'
const STORE_IMAGES = 'images'

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
    }
  })
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

export function imageCacheKey(repo: string, path: string): string {
  return `${repo.trim()}|${path}`
}

export async function getPromptsCache(
  repo: string,
): Promise<PromptsCacheRecord | null> {
  try {
    const db = await openDb()
    try {
      const tx = db.transaction(STORE_PROMPTS, 'readonly')
      const row = await idbReq(
        tx.objectStore(STORE_PROMPTS).get(repo.trim()) as IDBRequest<
          PromptsCacheRecord | undefined
        >,
      )
      return row ?? null
    } finally {
      db.close()
    }
  } catch {
    return null
  }
}

export async function putPromptsCache(
  record: PromptsCacheRecord,
): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_PROMPTS, 'readwrite')
    await idbReq(tx.objectStore(STORE_PROMPTS).put(record))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function getImageBlob(
  repo: string,
  path: string,
): Promise<Blob | null> {
  try {
    const db = await openDb()
    try {
      const tx = db.transaction(STORE_IMAGES, 'readonly')
      const row = await idbReq(
        tx.objectStore(STORE_IMAGES).get(imageCacheKey(repo, path)) as IDBRequest<
          ImageCacheRecord | undefined
        >,
      )
      return row?.blob ?? null
    } finally {
      db.close()
    }
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
    const db = await openDb()
    try {
      const record: ImageCacheRecord = {
        key: imageCacheKey(repo, path),
        repo: repo.trim(),
        path,
        blob,
        updatedAt: new Date().toISOString(),
      }
      const tx = db.transaction(STORE_IMAGES, 'readwrite')
      await idbReq(tx.objectStore(STORE_IMAGES).put(record))
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  } catch {
    // Soft-fail — memory cache still works
  }
}

/** Clear prompts (+ optional images) for one repo, or everything if repo omitted. */
export async function clearPromptsCache(repo?: string): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_PROMPTS, 'readwrite')
    const store = tx.objectStore(STORE_PROMPTS)
    if (repo?.trim()) {
      await idbReq(store.delete(repo.trim()))
    } else {
      await idbReq(store.clear())
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function clearImageCacheStore(repo?: string): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_IMAGES, 'readwrite')
    const store = tx.objectStore(STORE_IMAGES)
    if (repo?.trim()) {
      const r = repo.trim()
      const all = await idbReq(
        store.getAll() as IDBRequest<ImageCacheRecord[]>,
      )
      await Promise.all(
        (all ?? [])
          .filter((row) => row.repo === r)
          .map((row) => idbReq(store.delete(row.key))),
      )
    } else {
      await idbReq(store.clear())
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** Wipe prompts JSON cache + image blobs (all repos). */
export async function clearAllLocalCache(): Promise<void> {
  await clearPromptsCache()
  await clearImageCacheStore()
}

export async function getCacheStats(repo?: string): Promise<{
  hasPrompts: boolean
  promptCount: number
  updatedAt: string | null
  imageCount: number
}> {
  const prompts = repo?.trim()
    ? await getPromptsCache(repo)
    : null
  let imageCount = 0
  try {
    const db = await openDb()
    try {
      const tx = db.transaction(STORE_IMAGES, 'readonly')
      const store = tx.objectStore(STORE_IMAGES)
      if (repo?.trim()) {
        const all = await idbReq(
          store.getAll() as IDBRequest<ImageCacheRecord[]>,
        )
        imageCount = (all ?? []).filter((r) => r.repo === repo.trim()).length
      } else {
        imageCount = await idbReq(store.count())
      }
    } finally {
      db.close()
    }
  } catch {
    imageCount = 0
  }
  return {
    hasPrompts: Boolean(prompts),
    promptCount: prompts?.prompts.length ?? 0,
    updatedAt: prompts?.updatedAt ?? null,
    imageCount,
  }
}
