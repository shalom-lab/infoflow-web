import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { KeywordFilter } from '../components/KeywordFilter'
import { PromptCard } from '../components/PromptCard'
import { PromptDetailModal } from '../components/PromptDetailModal'
import { SearchBar } from '../components/SearchBar'
import {
  loadDemoPrompts,
  loadPromptsRemote,
  savePromptsToCache,
} from '../github/client'
import { isConfigured } from '../github/storage'
import { friendlyGithubError, type GithubSettings } from '../github/types'
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
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

export function HomePage({ settings }: Props) {
  const [prompts, setPrompts] = useState<PromptItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [query, setQuery] = useState('')
  const [keyword, setKeyword] = useState<string | null>(null)
  const [detailPrompt, setDetailPrompt] = useState<PromptItem | null>(null)
  const configured = isConfigured(settings)
  const [searchParams, setSearchParams] = useSearchParams()

  /**
   * Stale-while-revalidate:
   * 1) show IndexedDB cache immediately
   * 2) fetch remote in background; update UI + IDB only when sha/etag changes
   * force=true skips conditional headers and always replaces cache.
   */
  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true
      setError(null)

      if (!isConfigured(settings)) {
        setLoading(true)
          try {
          const list = await loadDemoPrompts()
          setPrompts(list)
          setDemoMode(true)
          setInfo(
            '当前为演示数据。请在设置中填写 InfoFlow 私有仓 owner/repo 与 PAT 以加载完整库。',
          )
        } catch (e) {
          setError(friendlyGithubError(e))
          setPrompts([])
        } finally {
          setLoading(false)
        }
        return
      }

      setDemoMode(false)
      const repo = settings.repo.trim()

      // 1) Hydrate from IndexedDB first (unless force and we want spinner-only —
      //    still show cache while forcing network for snappy UX)
      let cachedSha: string | null = null
      let cachedUpdatedAt: string | null = null
      try {
        const cached = await getPromptsCache(repo)
        if (cached && cached.prompts.length > 0) {
          setPrompts(cached.prompts)
          cachedSha = cached.sha
          cachedUpdatedAt = cached.updatedAt
          if (!force) {
            setInfo(
              `已显示本地缓存 ${cached.prompts.length} 条（${formatCacheTime(cached.updatedAt)}），正在后台检查更新…`,
            )
          }
        } else {
          setLoading(true)
          setInfo(null)
        }
      } catch {
        setLoading(true)
      }

      // 2) Background / forced remote fetch
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
          setInfo(
            `远程未变化（${remote.prompts.length} 条，sha 一致）。继续使用本地缓存。${when}`,
          )
          return
        }

        setPrompts(remote.prompts)
        await savePromptsToCache(settings, remote)
        setInfo(
          force
            ? `已强制刷新：从 ${repo} 写入本地 ${remote.prompts.length} 条`
            : `已更新：从 ${repo} 同步 ${remote.prompts.length} 条并写入本地缓存`,
        )
      } catch (e) {
        // Keep showing cache if we have it
        setError(friendlyGithubError(e))
        if (cachedSha) {
          setInfo('远程拉取失败，仍显示本地缓存。')
        } else {
          setPrompts([])
        }
      } finally {
        setLoading(false)
      }
    },
    [settings],
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
      if (keyword && !p.keywords.includes(keyword)) return false
      return matchesQuery(p, query)
    })
  }, [prompts, query, keyword])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      (b.savedAt || '').localeCompare(a.savedAt || ''),
    )
  }, [filtered])

  return (
    <div className="page home-page">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            IF
          </div>
          <div>
            <h1 className="brand-title">InfoFlow Prompt</h1>
            <p className="brand-sub">效果图 · 标题标签 · 完整提示词</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn"
            disabled={loading}
            onClick={() => void refresh({ force: true })}
            title="忽略缓存条件请求，强制从 GitHub 拉取并写回 IndexedDB"
          >
            {loading ? '同步中…' : '强制刷新'}
          </button>
          <Link to="/settings" className="btn primary">
            设置
          </Link>
        </div>
      </header>

      {!configured && (
        <div className="banner warn setup-banner">
          <div>
            <strong>尚未配置 BYOK</strong>
            <p>
              请前往{' '}
              <Link to="/settings">设置</Link> 填写 InfoFlow 仓库（建议{' '}
              <code>shalom-lab/InfoFlow</code>）与具有 Contents 读权限的 PAT。
              也可事先写入 localStorage 键 <code>gh-infoflow-repo</code> /{' '}
              <code>gh-infoflow-token</code>；启动会自动读。
            </p>
          </div>
          <Link to="/settings" className="btn primary">
            去设置
          </Link>
        </div>
      )}

      {info && <div className="banner success">{info}</div>}
      {error && <div className="banner error">{error}</div>}

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
          {!configured && (
            <Link to="/settings" className="btn primary">
              配置仓库与 PAT
            </Link>
          )}
        </div>
      ) : (
        <div className="prompt-grid">
          {sorted.map((p) => (
            <PromptCard
              key={p.prompt_id}
              prompt={p}
              settings={configured ? settings : null}
              imagesEnabled={configured && !demoMode}
              onKeywordClick={(kw) =>
                setKeyword((cur) => (cur === kw ? null : kw))
              }
              activeKeyword={keyword}
              onOpenDetail={setDetailPrompt}
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
    </div>
  )
}
