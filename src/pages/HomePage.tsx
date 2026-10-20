import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ImageCountFilter } from '../components/ImageCountFilter'
import { KeywordFilter } from '../components/KeywordFilter'
import { MonthFilter } from '../components/MonthFilter'
import { PromptCard } from '../components/PromptCard'
import { PromptDetailModal } from '../components/PromptDetailModal'
import { SearchBar } from '../components/SearchBar'
import { SelectedDrawer } from '../components/SelectedDrawer'
import { ToastStack, type ToastItem, type ToastKind } from '../components/Toast'
import {
  loadDemoPrompts,
  loadPromptsRemote,
  savePromptsToCache,
} from '../github/client'
import { isConfigured } from '../github/storage'
import { friendlyGithubError, type GithubSettings } from '../github/types'
import { useFeatured } from '../hooks/useFeatured'
import { useSelectedPrompts } from '../hooks/useSelectedPrompts'
import { getPromptsCache } from '../idb/cache'
import { promptImageCount, promptMonth, type PromptItem } from '../types/prompt'

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
  const [replyKeywords, setReplyKeywords] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [countMin, setCountMin] = useState(1)
  /** null = use full data range (avoids filtering before bounds sync). */
  const [countMax, setCountMax] = useState<number | null>(null)
  const [onlyFeatured, setOnlyFeatured] = useState(false)
  const [detailPrompt, setDetailPrompt] = useState<PromptItem | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
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

  const {
    selected,
    count: selectedCount,
    isSelected,
    toggle: toggleSelect,
    remove: removeSelected,
    clear: clearSelected,
  } = useSelectedPrompts()

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

  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    for (const p of prompts) {
      const m = promptMonth(p)
      if (m) set.add(m)
    }
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [prompts])

  const imageCountBoundMin = 1

  const imageCountBoundMax = useMemo(() => {
    let hi = 0
    for (const p of prompts) {
      hi = Math.max(hi, promptImageCount(p))
    }
    return hi
  }, [prompts])

  useEffect(() => {
    setCountMin(imageCountBoundMin)
    setCountMax(null)
  }, [imageCountBoundMax])

  const effectiveCountMax = countMax ?? imageCountBoundMax
  const countFilterActive = imageCountBoundMax >= imageCountBoundMin

  /** Other filters first; reply_keyword facets come from this subset. */
  const baseFiltered = useMemo(() => {
    return prompts.filter((p) => {
      if (onlyFeatured && !isFeatured(p.prompt_id)) return false
      if (selectedMonth && promptMonth(p) !== selectedMonth) return false
      if (countFilterActive) {
        const n = promptImageCount(p)
        if (n < countMin || n > effectiveCountMax) return false
      }
      return matchesQuery(p, query)
    })
  }, [
    prompts,
    query,
    selectedMonth,
    countMin,
    effectiveCountMax,
    countFilterActive,
    onlyFeatured,
    isFeatured,
  ])

  const topReplyKeywords = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of baseFiltered) {
      const rk = p.reply_keyword?.trim()
      if (!rk) continue
      counts.set(rk, (counts.get(rk) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
      .map(([k]) => k)
  }, [baseFiltered])

  const filtered = useMemo(() => {
    if (replyKeywords.length === 0) return baseFiltered
    const want = new Set(replyKeywords)
    return baseFiltered.filter((p) => {
      const rk = p.reply_keyword?.trim()
      return Boolean(rk && want.has(rk))
    })
  }, [baseFiltered, replyKeywords])

  const toggleReplyKeyword = useCallback((kw: string) => {
    setReplyKeywords((prev) =>
      prev.includes(kw) ? prev.filter((k) => k !== kw) : [...prev, kw],
    )
  }, [])

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
      <div className="home-sticky">
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
              className={`btn sm filter-toggle${selectMode ? ' primary' : ''}`}
              onClick={() => setSelectMode((v) => !v)}
              aria-pressed={selectMode}
              title="开启后可勾选提示词加入已选"
            >
              选择
            </button>
            <button
              type="button"
              className="btn sm cart-btn"
              onClick={() => setCartOpen(true)}
              title="查看已选提示词"
            >
              已选
              {selectedCount > 0 && (
                <span className="cart-badge">{selectedCount}</span>
              )}
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

        <div className="toolbar">
          <SearchBar
            value={query}
            onChange={setQuery}
            count={sorted.length}
            total={prompts.length}
          />
          <ImageCountFilter
            boundMin={imageCountBoundMin}
            boundMax={imageCountBoundMax}
            valueMin={countMin}
            valueMax={effectiveCountMax}
            onChange={(lo, hi) => {
              setCountMin(lo)
              setCountMax(hi)
            }}
          />
        </div>

        <KeywordFilter
          keywords={topReplyKeywords}
          selected={replyKeywords}
          onToggle={toggleReplyKeyword}
          onClear={() => setReplyKeywords([])}
        />
      </div>

      <div className="home-body">
        <MonthFilter
          months={availableMonths}
          selected={selectedMonth}
          onSelect={setSelectedMonth}
        />
        <div className="home-main">
      {!configured && (
        <div className="banner warn setup-banner compact-banner">
          <div>
            <strong>尚未配置 BYOK</strong>
            <p>
              请前往 <Link to="/settings">设置</Link> 填写你的 Prompt 数据仓{' '}
              <code>owner/repo</code> 与 PAT（
              <code>gh-infoflow-repo</code> / <code>gh-infoflow-token</code>
              ）。
            </p>
          </div>
          <Link to="/settings" className="btn sm primary">
            去设置
          </Link>
        </div>
      )}

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
              onOpenDetail={setDetailPrompt}
              onToggleFeatured={toggleFeatured}
              selectMode={selectMode}
              selected={isSelected(p.prompt_id)}
              onToggleSelect={(item) => void toggleSelect(item)}
            />
          ))}
        </div>
      )}
        </div>
      </div>

      {detailPrompt && !selectMode && (
        <PromptDetailModal
          prompt={detailPrompt}
          settings={configured ? settings : null}
          imagesEnabled={configured && !demoMode}
          onClose={() => setDetailPrompt(null)}
        />
      )}

      <SelectedDrawer
        open={cartOpen}
        items={selected}
        onClose={() => setCartOpen(false)}
        onRemove={(id) => void removeSelected(id)}
        onClear={() => void clearSelected()}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
