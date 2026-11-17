import { useTheme } from '../hooks/useTheme'
import { MoonIcon, SunIcon } from './appIcons'

/** Light/dark switch. Takes its colour from the surrounding text, so it fits on any background. */
export default function ThemeToggle({ className = '', showLabel = false }) {
  const { theme, toggleTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      {showLabel && <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>}
    </button>
  )
}
