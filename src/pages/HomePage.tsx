import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { KeywordFilter } from '../components/KeywordFilter'
import { PromptCard } from '../components/PromptCard'
import { PromptDetailModal } from '../components/PromptDetailModal'
import { SearchBar } from '../components/SearchBar'
import { ToastStack, type ToastItem, type ToastKind } from '../components/Toast'
import {
  loadDemoPrompts,
  loadPromptsRemote,
  savePromptsToCache,
} from '../github/client'
import { isConfigured } from '../github/storage'
import { friendlyGithubError, type GithubSettings } from '../github/types'
import { useFeatured } from '../hooks/useFeatured'
import { getPromptsCache } from '../idb/cache'
import type { PromptItem } from '../types/prompt'

interface Props {
  settings: GithubSettings
}

function matchesQuery(p: PromptItem, q: string): boolean {
  if (!q) return true
  const hay = [p.wechat_title, p.content, p.reply_keyword ?? '', ...p.keywords]
    .join(' ')
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term))
}

function formatCacheTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

export function HomePage({ settings }: Props) {
  const [prompts, setPrompts] = useState<PromptItem[]>([])
  const [loading, setLoading] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [query, setQuery] = useState('')
  const [keyword, setKeyword] = useState<string | null>(null)
  const [onlyFeatured, setOnlyFeatured] = useState(false)
  const [detailPrompt, setDetailPrompt] = useState<PromptItem | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const toastId = useRef(1)
  const configured = isConfigured(settings)
  const [searchParams, setSearchParams] = useSearchParams()

  const pushToast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = toastId.current++
    setToasts((prev) => [...prev.slice(-4), { id, message, kind }])
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const { isFeatured, toggleFeatured } = useFeatured(settings, (msg, kind) =>
    pushToast(msg, kind ?? 'info'),
  )

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true

      if (!isConfigured(settings)) {
        setLoading(true)
        try {
          const list = await loadDemoPrompts()
          setPrompts(list)
          setDemoMode(true)
          pushToast(
            '当前为演示数据。请在设置中填写仓库与 PAT。',
            'warn',
          )
        } catch (e) {
          pushToast(friendlyGithubError(e), 'error')
          setPrompts([])
        } finally {
          setLoading(false)
        }
        return
      }

      setDemoMode(false)
      const repo = settings.repo.trim()

      let cachedSha: string | null = null
      let cachedUpdatedAt: string | null = null
      try {
        const cached = await getPromptsCache(repo)
        if (cached && cached.prompts.length > 0) {
          setPrompts(cached.prompts)
          cachedSha = cached.sha
          cachedUpdatedAt = cached.updatedAt
          if (!force) {
            pushToast(
              `已显示本地缓存 ${cached.prompts.length} 条（${formatCacheTime(cached.updatedAt)}），正在后台检查更新…`,
              'info',
            )
          }
        } else {
          setLoading(true)
        }
      } catch {
        setLoading(true)
      }

      setLoading(true)
      try {
        const remote = await loadPromptsRemote(settings, { force })

        const unchanged =
          !force &&
          cachedSha != null &&
          remote.sha === cachedSha &&
          remote.prompts.length > 0

        if (unchanged) {
          const when = cachedUpdatedAt
            ? `缓存于 ${formatCacheTime(cachedUpdatedAt)}`
            : ''
          pushToast(
            `远程未变化（${remote.prompts.length} 条）。继续使用本地缓存。${when}`,
            'success',
          )
          return
        }

        setPrompts(remote.prompts)
        await savePromptsToCache(settings, remote)
        pushToast(
          force
            ? `已强制刷新：从 ${repo} 写入本地 ${remote.prompts.length} 条`
            : `已更新：从 ${repo} 同步 ${remote.prompts.length} 条并写入本地缓存`,
          'success',
        )
      } catch (e) {
        pushToast(friendlyGithubError(e), 'error')
        if (!cachedSha) setPrompts([])
        else pushToast('远程拉取失败，仍显示本地缓存。', 'warn')
      } finally {
        setLoading(false)
      }
    },
    [settings, pushToast],
  )

  const forceFlag = searchParams.get('force') === '1'

  useEffect(() => {
    void refresh({ force: forceFlag }).then(() => {
      if (forceFlag) {
        const next = new URLSearchParams(searchParams)
        next.delete('force')
        setSearchParams(next, { replace: true })
      }
    })
  }, [refresh, forceFlag, searchParams, setSearchParams])

  const topKeywords = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of prompts) {
      for (const kw of p.keywords) {
        counts.set(kw, (counts.get(kw) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
      .slice(0, 24)
      .map(([k]) => k)
  }, [prompts])

  const filtered = useMemo(() => {
    return prompts.filter((p) => {
      if (onlyFeatured && !isFeatured(p.prompt_id)) return false
      if (keyword && !p.keywords.includes(keyword)) return false
      return matchesQuery(p, query)
    })
  }, [prompts, query, keyword, onlyFeatured, isFeatured])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const fa = isFeatured(a.prompt_id) ? 1 : 0
      const fb = isFeatured(b.prompt_id) ? 1 : 0
      if (fb !== fa) return fb - fa
      return (b.savedAt || '').localeCompare(a.savedAt || '')
    })
  }, [filtered, isFeatured])

  return (
    <div className="page home-page">
      <header className="app-header compact">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            IF
          </div>
          <div>
            <h1 className="brand-title">InfoFlow Prompt</h1>
            <p className="brand-sub">效果图 · 提示词卡片</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className={`btn sm filter-toggle${onlyFeatured ? ' primary' : ''}`}
            onClick={() => setOnlyFeatured((v) => !v)}
            aria-pressed={onlyFeatured}
          >
            ★ 精选
          </button>
          <button
            type="button"
            className="btn sm"
            disabled={loading}
            onClick={() => void refresh({ force: true })}
            title="强制从 GitHub 拉取并写回 IndexedDB"
          >
            {loading ? '同步中…' : '刷新'}
          </button>
          <Link to="/settings" className="btn sm primary">
            设置
          </Link>
        </div>
      </header>

      {!configured && (
        <div className="banner warn setup-banner compact-banner">
          <div>
            <strong>尚未配置 BYOK</strong>
            <p>
              请前往 <Link to="/settings">设置</Link> 填写{' '}
              <code>shalom-lab/InfoFlow</code> 与 PAT（
              <code>gh-infoflow-repo</code> / <code>gh-infoflow-token</code>
              ）。
            </p>
          </div>
          <Link to="/settings" className="btn sm primary">
            去设置
          </Link>
        </div>
      )}

      <div className="toolbar">
        <SearchBar
          value={query}
          onChange={setQuery}
          count={sorted.length}
          total={prompts.length}
        />
      </div>

      <KeywordFilter
        keywords={topKeywords}
        selected={keyword}
        onSelect={setKeyword}
      />

      {loading && prompts.length === 0 ? (
        <div className="empty-state">
          <p>正在加载提示词…</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <p>{prompts.length === 0 ? '暂无数据' : '没有匹配的提示词'}</p>
        </div>
      ) : (
        <div className="prompt-masonry">
          {sorted.map((p) => (
            <PromptCard
              key={p.prompt_id}
              prompt={p}
              settings={configured ? settings : null}
              imagesEnabled={configured && !demoMode}
              featured={isFeatured(p.prompt_id)}
              onKeywordClick={(kw) =>
                setKeyword((cur) => (cur === kw ? null : kw))
              }
              activeKeyword={keyword}
              onOpenDetail={setDetailPrompt}
              onToggleFeatured={toggleFeatured}
            />
          ))}
        </div>
      )}

      {detailPrompt && (
        <PromptDetailModal
          prompt={detailPrompt}
          settings={configured ? settings : null}
          imagesEnabled={configured && !demoMode}
          onClose={() => setDetailPrompt(null)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
