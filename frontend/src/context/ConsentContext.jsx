import { useCallback, useMemo, useState } from 'react'
import { CONSENT_VERSION, ConsentContext, readConsent, writeConsent } from './consentStore'

export function ConsentProvider({ children }) {
  const [consent, setConsent] = useState(readConsent)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const savePreferences = useCallback(({ analytics = false, functional = false }) => {
    const next = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: Boolean(analytics),
      functional: Boolean(functional),
      preferences: Boolean(functional),
      decidedAt: new Date().toISOString(),
    }
    writeConsent(next)
    setConsent(next)
    setSettingsOpen(false)
  }, [])

  const acceptAll = useCallback(() => {
    savePreferences({ analytics: true, functional: true })
  }, [savePreferences])

  const rejectAll = useCallback(() => {
    savePreferences({ analytics: false, functional: false })
  }, [savePreferences])

  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const value = useMemo(
    () => ({
      consent,
      decided: consent !== null,
      necessaryAllowed: true,
      analyticsAllowed: consent?.analytics === true,
      functionalAllowed: consent?.functional === true,
      preferencesAllowed: consent?.functional === true,
      settingsOpen,
      savePreferences,
      acceptAll,
      rejectAll,
      rejectOptional: rejectAll,
      openSettings,
      closeSettings,
    }),
    [consent, settingsOpen, savePreferences, acceptAll, rejectAll, openSettings, closeSettings]
  )

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}
