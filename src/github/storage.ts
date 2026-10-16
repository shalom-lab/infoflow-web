import { DEFAULT_SETTINGS, type GithubSettings } from './types'

/** Flat, hyphenated BYOK keys — mandatory convention. app = infoflow */
export const KEY_TOKEN = 'gh-infoflow-token'
export const KEY_REPO = 'gh-infoflow-repo'

/**
 * Silently read both keys from localStorage into settings shape.
 * No modal interrupt — call on App start.
 */
export function loadSettings(): GithubSettings {
  try {
    return {
      token: localStorage.getItem(KEY_TOKEN) ?? '',
      repo: localStorage.getItem(KEY_REPO) ?? '',
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** save = setItem for each flat key (never a JSON blob of secrets). */
export function saveSettings(settings: GithubSettings): void {
  localStorage.setItem(KEY_TOKEN, settings.token.trim())
  localStorage.setItem(KEY_REPO, settings.repo.trim())
}

/** clear = removeItem for both keys. */
export function clearSettings(): void {
  localStorage.removeItem(KEY_TOKEN)
  localStorage.removeItem(KEY_REPO)
}

export function isConfigured(settings: GithubSettings): boolean {
  return Boolean(settings.token.trim() && settings.repo.trim().includes('/'))
}
