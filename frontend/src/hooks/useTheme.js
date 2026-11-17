import { useContext } from 'react'
import { ThemeContext } from '../context/themeStore'

/** Returns { theme: 'light' | 'dark', preference: 'light' | 'dark' | 'system', setPreference, toggleTheme }. */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
