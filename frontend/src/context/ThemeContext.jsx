import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConsent } from './consentStore'
import { THEME_KEY, ThemeContext, readStoredPreference, systemPrefersDark } from './themeStore'

/**
 * One theme for the whole app: every toggle (landing, sign-in, dashboard,
 * policy pages) shares this state. The choice is only saved to the browser once
 * the visitor allows "Preferences" in the cookie dialog.
 */
export function ThemeProvider({ children }) {
  const { preferencesAllowed } = useConsent()
  const [preference, setPreference] = useState(readStoredPreference)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return undefined
    const onChange = (event) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    try {
      if (preferencesAllowed) {
        localStorage.setItem(THEME_KEY, preference)
      } else {
        localStorage.removeItem(THEME_KEY)
      }
    } catch {
      // Storage unavailable: the theme still works for this visit.
    }
  }, [preference, preferencesAllowed])

  const toggleTheme = useCallback(() => {
    setPreference(theme === 'dark' ? 'light' : 'dark')
  }, [theme])

  const value = useMemo(
    () => ({ theme, preference, setPreference, toggleTheme }),
    [theme, preference, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
