import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadFeaturedRemote,
  saveFeaturedRemote,
} from '../github/client'
import { isConfigured } from '../github/storage'
import { GithubApiError, type GithubSettings } from '../github/types'
import {
  getFeaturedCache,
  putFeaturedCache,
} from '../idb/cache'
import type { FeaturedMap } from '../types/featured'

const DEBOUNCE_MS = 1600

/**
 * Featured stars: local IDB first, debounce then silent batch write to
 * data/prompt_featured.json. Does not touch data_all_prompts.json.
 *
 * Missing remote file (404) → empty map, no toast.
 */
export function useFeatured(
  settings: GithubSettings,
  onNotice?: (msg: string, kind?: 'success' | 'warn' | 'error') => void,
) {
  const [map, setMap] = useState<FeaturedMap>({})
  const [remoteSha, setRemoteSha] = useState<string | null>(null)
  const [canSync, setCanSync] = useState(false)
  const dirtyRef = useRef(false)
  const mapRef = useRef<FeaturedMap>({})
  const shaRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  // Stable notice callback — avoid re-hydrate loops when parent passes inline fn
  const onNoticeRef = useRef(onNotice)
  onNoticeRef.current = onNotice

  useEffect(() => {
    mapRef.current = map
  }, [map])
  useEffect(() => {
    shaRef.current = remoteSha
  }, [remoteSha])

  const persistLocal = useCallback(
    async (next: FeaturedMap, sha: string | null, dirty: boolean) => {
      const s = settingsRef.current
      if (!isConfigured(s)) return
      await putFeaturedCache({
        repo: s.repo.trim(),
        map: next,
        remoteSha: sha,
        dirty,
        updatedAt: new Date().toISOString(),
      })
    },
    [],
  )

  const flushRemote = useCallback(async () => {
    const s = settingsRef.current
    if (!isConfigured(s) || !dirtyRef.current) return
    try {
      const result = await saveFeaturedRemote(
        s,
        mapRef.current,
        shaRef.current,
      )
      dirtyRef.current = false
      setRemoteSha(result.sha)
      shaRef.current = result.sha
      await persistLocal(mapRef.current, result.sha, false)
      setCanSync(true)
      onNoticeRef.current?.('精选已同步到 GitHub', 'success')
    } catch (e) {
      setCanSync(false)
      const status = e instanceof GithubApiError ? e.status : 0
      // Only warn on real write failures (auth / permission / conflict)
      if (status === 401 || status === 403 || status === 409 || status === 422) {
        const msg = e instanceof Error ? e.message : String(e)
        onNoticeRef.current?.(
          `精选已保存在本地，但无法写回 GitHub（${msg}）。请确认 PAT 有 Contents 写权限。`,
          'warn',
        )
      } else if (e instanceof Error) {
        onNoticeRef.current?.(
          `精选已保存在本地，写回失败：${e.message}`,
          'warn',
        )
      }
    }
  }, [persistLocal])

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void flushRemote()
    }, DEBOUNCE_MS)
  }, [flushRemote])

  const hydrate = useCallback(async () => {
    const s = settingsRef.current
    if (!isConfigured(s)) {
      setMap({})
      setRemoteSha(null)
      setCanSync(false)
      return
    }
    const repo = s.repo.trim()
    let local = await getFeaturedCache(repo)
    if (local) {
      setMap(local.map)
      mapRef.current = local.map
      setRemoteSha(local.remoteSha)
      shaRef.current = local.remoteSha
      dirtyRef.current = local.dirty
    }
    try {
      // 404 → empty map + sha null (loadFeaturedRemote already soft-handles)
      const remote = await loadFeaturedRemote(s)
      setCanSync(true)
      if (local?.dirty) {
        if (remote.sha && !local.remoteSha) {
          setRemoteSha(remote.sha)
          shaRef.current = remote.sha
        }
        scheduleFlush()
      } else {
        setMap(remote.map)
        mapRef.current = remote.map
        setRemoteSha(remote.sha)
        shaRef.current = remote.sha
        await persistLocal(remote.map, remote.sha, false)
      }
    } catch (e) {
      // Missing file must never reach here; only auth/network etc.
      if (!local) setMap({})
      const status = e instanceof GithubApiError ? e.status : 0
      if (status === 404) {
        // Belt-and-suspenders: treat as empty, silent
        setCanSync(true)
        setRemoteSha(null)
        shaRef.current = null
        if (!local?.dirty) {
          setMap({})
          mapRef.current = {}
          await persistLocal({}, null, false)
        }
        return
      }
      setCanSync(false)
      if (status === 401 || status === 403) {
        onNoticeRef.current?.(
          '无法读取远程精选（认证/权限）。本地标记仍可用；写回需 Contents 写权限。',
          'warn',
        )
      } else if (e instanceof TypeError || (e instanceof Error && /network|fetch/i.test(e.message))) {
        onNoticeRef.current?.(
          '网络异常，无法读取远程精选；本地标记仍可用。',
          'warn',
        )
      }
      // Other errors: silent keep local — avoid toast spam
    }
  }, [persistLocal, scheduleFlush])

  useEffect(() => {
    void hydrate()
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [hydrate, settings.repo, settings.token])

  const isFeatured = useCallback(
    (promptId: string) => Boolean(map[promptId]),
    [map],
  )

  const toggleFeatured = useCallback(
    (promptId: string) => {
      setMap((prev) => {
        const next = { ...prev }
        if (next[promptId]) delete next[promptId]
        else next[promptId] = true
        mapRef.current = next
        dirtyRef.current = true
        void persistLocal(next, shaRef.current, true)
        const s = settingsRef.current
        if (isConfigured(s)) {
          scheduleFlush()
        } else {
          onNoticeRef.current?.(
            '精选已保存在本地（未配置 PAT，无法同步到 GitHub）',
            'warn',
          )
        }
        return next
      })
    },
    [persistLocal, scheduleFlush],
  )

  return { map, isFeatured, toggleFeatured, canSync, reload: hydrate }
}
