import { createContext } from 'react'

export const ThemeContext = createContext(null)

export const THEME_KEY = 'northbank-theme'
export const THEME_PREFERENCES = ['light', 'dark', 'system']

export function readStoredPreference() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return THEME_PREFERENCES.includes(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function systemPrefersDark() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
}
