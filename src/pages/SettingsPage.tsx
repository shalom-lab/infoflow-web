import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clearImageCache, testConnection } from '../github/client'
import {
  clearSettings,
  isConfigured,
  saveSettings,
} from '../github/storage'
import {
  DEFAULT_SETTINGS,
  friendlyGithubError,
  maskToken,
  REPO_PLACEHOLDER,
  type GithubSettings,
} from '../github/types'
import {
  clearAllLocalCache,
  getCacheStats,
} from '../idb/cache'

interface Props {
  settings: GithubSettings
  onSaved: (settings: GithubSettings) => void
}

export function SettingsPage({ settings, onSaved }: Props) {
  const [tokenInput, setTokenInput] = useState('')
  const [repoInput, setRepoInput] = useState('')
  const [saved, setSaved] = useState<GithubSettings>(settings)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [cacheInfo, setCacheInfo] = useState<string>('检查中…')

  const refreshCacheInfo = async (repo: string) => {
    try {
      const stats = await getCacheStats(repo.trim() || undefined)
      if (!stats.hasPrompts && stats.imageCount === 0) {
        setCacheInfo('无本地缓存')
        return
      }
      const parts: string[] = []
      if (stats.hasPrompts) {
        parts.push(
          `提示词 ${stats.promptCount} 条${
            stats.updatedAt
              ? `（${new Date(stats.updatedAt).toLocaleString('zh-CN', { hour12: false })}）`
              : ''
          }`,
        )
      }
      if (stats.imageCount > 0) {
        parts.push(`效果图 blob ${stats.imageCount} 张`)
      }
      if (stats.featuredCount > 0) {
        parts.push(`精选 ${stats.featuredCount}`)
      }
      setCacheInfo(parts.join(' · '))
    } catch {
      setCacheInfo('无法读取缓存状态')
    }
  }

  useEffect(() => {
    setSaved(settings)
    setRepoInput(settings.repo || '')
    setTokenInput('')
    void refreshCacheInfo(settings.repo)
  }, [settings])

  const tokenStatus = saved.token.trim()
    ? `已保存 ${maskToken(saved.token)}`
    : '未设置'
  const repoStatus = saved.repo.trim() ? `已保存 ${saved.repo}` : '未设置'

  const handleSave = () => {
    const next: GithubSettings = {
      token: tokenInput.trim() || saved.token,
      repo: repoInput.trim(),
    }
    if (!next.token.trim()) {
      setErr('请填写 GitHub PAT')
      setMsg(null)
      return
    }
    if (!next.repo.includes('/')) {
      setErr('仓库请填写 owner/repo 格式')
      setMsg(null)
      return
    }
    saveSettings(next)
    setSaved(next)
    setTokenInput('')
    onSaved(next)
    setMsg('已保存')
    setErr(null)
    void refreshCacheInfo(next.repo)
  }

  const handleClear = () => {
    if (!confirm('确定清除本地 PAT 与仓库设置？')) return
    clearSettings()
    clearImageCache()
    const empty = { ...DEFAULT_SETTINGS }
    setSaved(empty)
    setTokenInput('')
    setRepoInput('')
    onSaved(empty)
    setMsg('已清除本地设置')
    setErr(null)
  }

  const handleClearCache = async () => {
    if (
      !confirm('确定清除本地缓存？下次将重新从 GitHub 拉取。')
    ) {
      return
    }
    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      await clearAllLocalCache()
      clearImageCache()
      setMsg('已清除本地缓存（设置保留）')
      await refreshCacheInfo(saved.repo)
    } catch (e) {
      setErr(friendlyGithubError(e))
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async () => {
    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      const candidate: GithubSettings = {
        token: tokenInput.trim() || saved.token,
        repo: repoInput.trim() || saved.repo,
      }
      if (!isConfigured(candidate)) {
        throw new Error('请先填写 PAT 与 owner/repo')
      }
      const name = await testConnection(candidate)
      setMsg(`连接成功：${name}`)
    } catch (e) {
      setErr(friendlyGithubError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page settings-page">
      <header className="page-header">
        <Link to="/" className="back-link">
          ← 返回卡片
        </Link>
        <h1>设置</h1>
      </header>

      <section className="settings-card">
        <h2>GitHub BYOK</h2>
        <p className="hint">密钥只存在本机浏览器，不会写入代码或提交。</p>

        <hr className="settings-divider" />

        <label className="field">
          <span>
            仓库 <span className="status-pill">{repoStatus}</span>
          </span>
          <input
            placeholder={REPO_PLACEHOLDER}
            spellCheck={false}
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value.trim())}
          />
        </label>

        <label className="field">
          <span>
            GitHub PAT <span className="status-pill">{tokenStatus}</span>
          </span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={
              saved.token
                ? `已保存 ${maskToken(saved.token)} — 留空保持不变，或粘贴新 PAT`
                : 'ghp_… 或 github_pat_…'
            }
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
          />
        </label>

        {msg && <div className="banner success">{msg}</div>}
        {err && <div className="banner error">{err}</div>}

        <div className="settings-actions">
          <button type="button" className="btn danger" onClick={handleClear}>
            清除密钥
          </button>
          <div className="spacer" />
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void handleTest()}
          >
            {busy ? '测试中…' : '测试连接'}
          </button>
          <button type="button" className="btn primary" onClick={handleSave}>
            保存
          </button>
        </div>
      </section>

      <section className="settings-card" style={{ marginTop: '1.15rem' }}>
        <h2>本地缓存</h2>
        <p className="hint">
          列表与效果图缓存在本地，可清除后回首页重新拉取。
        </p>
        <p className="hint muted">
          当前：<strong>{cacheInfo}</strong>
        </p>
        <div className="settings-actions">
          <button
            type="button"
            className="btn danger"
            disabled={busy}
            onClick={() => void handleClearCache()}
          >
            清除缓存
          </button>
          <div className="spacer" />
          <Link to="/?force=1" className="btn primary" replace={false}>
            回首页强制刷新
          </Link>
        </div>
      </section>
    </div>
  )
}
