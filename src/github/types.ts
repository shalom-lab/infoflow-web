export interface GithubSettings {
  /** PAT from localStorage key gh-infoflow-token */
  token: string
  /** owner/name from localStorage key gh-infoflow-repo */
  repo: string
}

export const DEFAULT_SETTINGS: GithubSettings = {
  token: '',
  repo: '',
}

/** Placeholder text only — never a real default repo. */
export const REPO_PLACEHOLDER = 'owner/repo'

/** Data-repo default branch (Contents API). */
export const DEFAULT_BRANCH = 'master'
export const PROMPTS_PATH = 'data/data_all_prompts.json'
/** Side-channel featured map — does NOT alter data_all_prompts.json fields. */
export const FEATURED_PATH = 'data/prompt_featured.json'

export interface ParsedRepo {
  owner: string
  name: string
}

/** Split `owner/name` only when calling GitHub API. */
export function parseRepo(repo: string): ParsedRepo | null {
  const trimmed = repo.trim()
  const slash = trimmed.indexOf('/')
  if (slash <= 0 || slash === trimmed.length - 1) return null
  const owner = trimmed.slice(0, slash).trim()
  const name = trimmed.slice(slash + 1).trim()
  if (!owner || !name || name.includes('/')) return null
  return { owner, name }
}

export interface GithubFileContent {
  name: string
  path: string
  sha: string
  size: number
  /** Present for files ≤1MB; omitted/empty when Contents API uses encoding "none". */
  content?: string
  encoding?: string
  /** Raw file URL; prefer for files >1MB (Contents omits base64 content). */
  download_url?: string | null
}

export class GithubApiError extends Error {
  status: number
  /** True when GitHub secondary/primary rate limit (not a PAT scope issue). */
  rateLimited: boolean
  constructor(status: number, message: string, rateLimited = false) {
    super(message)
    this.name = 'GithubApiError'
    this.status = status
    this.rateLimited = rateLimited
  }
}

/** Detect rate-limit from headers + body message. */
export function isRateLimitHint(
  res: Response | null,
  message: string,
): boolean {
  if (/rate.?limit|API rate limit exceeded|secondary rate|abuse.?detect/i.test(message)) {
    return true
  }
  if (!res) return false
  const remaining = res.headers.get('x-ratelimit-remaining')
  if (remaining === '0') return true
  if (res.headers.get('retry-after')) return true
  const reset = res.headers.get('x-ratelimit-reset')
  if (remaining !== null && Number(remaining) === 0 && reset) return true
  return false
}

export function friendlyGithubError(err: unknown): string {
  if (err instanceof GithubApiError) {
    const msg = err.message || ''
    if (err.rateLimited || (err.status === 403 && isRateLimitHint(null, msg))) {
      return 'API 限流，稍后重试（大量效果图请求触发了 GitHub 速率限制，不是 PAT 权限问题）。'
    }
    switch (err.status) {
      case 401:
        return '认证失败 (401)：PAT 无效或已过期，请在设置中更新。'
      case 403:
        if (/工作流|Actions|actions:|workflow/i.test(msg)) {
          return msg.includes('403') || msg.startsWith('无权')
            ? msg
            : `权限不足 (403)：${msg}`
        }
        return '权限不足 (403)：PAT 需要 Contents 读写权限（触发删除还需 Actions: write）。'
      case 404:
        return '未找到 (404)：仓库/分支/路径不存在，或 PAT 无权访问私有仓库。'
      case 409:
        return '冲突 (409)：文件已被修改，请稍后重试同步精选。'
      case 422:
        return `请求无效 (422)：${msg}`
      case 429:
        return 'API 限流，稍后重试。'
      default:
        return `GitHub API 错误 (${err.status})：${msg}`
    }
  }
  if (err instanceof Error) return err.message
  return String(err)
}

/** Mask token for status display — never show full secret. */
export function maskToken(token: string): string {
  const t = token.trim()
  if (!t) return ''
  if (t.length <= 4) return '••••'
  return `••••${t.slice(-4)}`
}
