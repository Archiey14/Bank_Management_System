import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useConsent } from '../context/consentStore'
import { ShieldCheckIcon, CheckIcon } from './icons'
import './cookie.css'

export default function CookieConsent() {
  const {
    consent,
    decided,
    settingsOpen,
    acceptAll,
    rejectAll,
    savePreferences,
    openSettings,
    closeSettings,
  } = useConsent()

  const [analytics, setAnalytics] = useState(consent?.analytics ?? false)
  const [functional, setFunctional] = useState(consent?.functional ?? true)

  useEffect(() => {
    if (consent) {
      setAnalytics(consent.analytics ?? false)
      setFunctional(consent.functional ?? false)
    }
  }, [consent])

  const handleSaveModal = (e) => {
    e.preventDefault()
    savePreferences({ analytics, functional })
  }

  return (
    <>
      {/* Floating Bottom Consent Banner (if not yet decided and settings not open) */}
      {!decided && !settingsOpen && (
        <aside className="cookie-banner" aria-label="Cookie consent">
          <div className="cookie-banner__inner">
            <div className="cookie-banner__content">
              <div className="cookie-banner__header">
                <span className="cookie-banner__icon">
                  <ShieldCheckIcon />
                </span>
                <strong className="cookie-banner__title">Your Privacy &amp; Cookies</strong>
              </div>
              <p className="cookie-banner__text">
                Northbank uses essential cookies to authenticate your session and maintain secure
                banking services. With your permission, we also use optional functional and
                analytics cookies to remember preferences like your theme and understand site usage.
                Read our <Link to="/privacy" className="auth-link">Privacy Policy</Link> and{' '}
                <Link to="/terms" className="auth-link">Terms</Link>.
              </p>
            </div>
            <div className="cookie-banner__actions">
              <button
                type="button"
                className="cookie-btn cookie-btn--primary"
                onClick={acceptAll}
              >
                Accept All
              </button>
              <button
                type="button"
                className="cookie-btn cookie-btn--outline"
                onClick={rejectAll}
              >
                Reject All
              </button>
              <button
                type="button"
                className="cookie-btn cookie-btn--ghost"
                onClick={openSettings}
              >
                Manage Preferences
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Preferences Dialog / Modal */}
      {settingsOpen && (
        <div className="cookie-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cookie-modal-title">
          <div className="cookie-modal">
            <div className="cookie-modal__head">
              <div>
                <h3 id="cookie-modal-title" className="cookie-modal__title">
                  Cookie &amp; Tracking Preferences
                </h3>
                <p className="cookie-modal__sub">
                  Choose which cookies you allow Northbank to store on your device.
                </p>
              </div>
              <button
                type="button"
                className="cookie-modal__close"
                onClick={closeSettings}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveModal}>
              <div className="cookie-category">
                <div className="cookie-category__info">
                  <div className="cookie-category__title-row">
                    <span className="cookie-category__title">Strictly Necessary Cookies</span>
                    <span className="cookie-category__badge">Always Active</span>
                  </div>
                  <p className="cookie-category__desc">
                    Required for core banking operations, user authentication, session security,
                    and fraud prevention. These cannot be switched off.
                  </p>
                </div>
                <div className="cookie-toggle-wrap">
                  <input type="checkbox" checked disabled className="cookie-toggle" aria-label="Strictly Necessary Cookies (Always Active)" />
                </div>
              </div>

              <div className="cookie-category">
                <div className="cookie-category__info">
                  <div className="cookie-category__title-row">
                    <span className="cookie-category__title">Functional &amp; Preferences</span>
                  </div>
                  <p className="cookie-category__desc">
                    Allows the application to remember choices you make, such as your theme
                    preference (Light, Dark, or System) and language settings across visits.
                  </p>
                </div>
                <label className="cookie-switch">
                  <input
                    type="checkbox"
                    checked={functional}
                    onChange={(e) => setFunctional(e.target.checked)}
                    aria-label="Enable Functional Cookies"
                  />
                  <span className="cookie-slider" />
                </label>
              </div>

              <div className="cookie-category">
                <div className="cookie-category__info">
                  <div className="cookie-category__title-row">
                    <span className="cookie-category__title">Analytics &amp; Performance</span>
                  </div>
                  <p className="cookie-category__desc">
                    Helps us understand how customers navigate our banking platform, measure page
                    load performance, and improve usability without identifying individuals.
                  </p>
                </div>
                <label className="cookie-switch">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    aria-label="Enable Analytics Cookies"
                  />
                  <span className="cookie-slider" />
                </label>
              </div>

              <div className="cookie-modal__foot">
                <div className="cookie-modal__foot-left">
                  <button
                    type="button"
                    className="cookie-btn cookie-btn--ghost"
                    onClick={rejectAll}
                  >
                    Reject Optional
                  </button>
                  <button
                    type="button"
                    className="cookie-btn cookie-btn--ghost"
                    onClick={acceptAll}
                  >
                    Accept All
                  </button>
                </div>
                <button
                  type="submit"
                  className="cookie-btn cookie-btn--primary"
                >
                  Save Preferences
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
