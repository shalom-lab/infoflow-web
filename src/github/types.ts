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

/** Suggested default when Settings repo field is empty. */
export const SUGGESTED_REPO = 'shalom-lab/InfoFlow'

/** InfoFlow default branch is master (not main). */
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
  content: string
  encoding: string
}

export class GithubApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'GithubApiError'
    this.status = status
  }
}

export function friendlyGithubError(err: unknown): string {
  if (err instanceof GithubApiError) {
    const msg = err.message || ''
    switch (err.status) {
      case 401:
        return '认证失败 (401)：PAT 无效或已过期，请在设置中更新。'
      case 403:
        return '权限不足 (403)：PAT 需要 Contents 读写权限，或触发了 API 限流。'
      case 404:
        return '未找到 (404)：仓库/分支/路径不存在，或 PAT 无权访问私有仓库。'
      case 409:
        return '冲突 (409)：文件已被修改，请稍后重试同步精选。'
      case 422:
        return `请求无效 (422)：${msg}`
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
