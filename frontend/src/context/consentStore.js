import { createContext, useContext } from 'react'

export const ConsentContext = createContext(null)

export const CONSENT_KEY = 'northbank-cookie-consent'
export const CONSENT_COOKIE = 'northbank_consent'
// Bump this when the categories or the policy change materially: everyone is
// asked again.
export const CONSENT_VERSION = 1

export function readConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== CONSENT_VERSION) return null
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      functional: Boolean(parsed.functional ?? parsed.preferences),
      preferences: Boolean(parsed.functional ?? parsed.preferences),
      decidedAt: parsed.decidedAt,
      version: CONSENT_VERSION,
    }
  } catch {
    return null
  }
}

export function writeConsent(consent) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
  } catch {
    // Storage can be blocked; choice lasts for this visit only.
  }
  try {
    const parts = ['necessary']
    if (consent.analytics) parts.push('analytics')
    if (consent.functional) parts.push('functional')
    const value = parts.join('.')
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${CONSENT_COOKIE}=${value}; max-age=${180 * 24 * 60 * 60}; path=/; SameSite=Lax${secure}`
  } catch {
    // Ignore: cookies unavailable.
  }
}

export function useConsent() {
  const context = useContext(ConsentContext)
  if (!context) {
    throw new Error('useConsent must be used within a ConsentProvider')
  }
  return context
}
