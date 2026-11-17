import { useConsent } from '../context/consentStore'

/** Button styled as a footer link that reopens the cookie preferences dialog. */
export default function CookieSettingsLink({ className = '', children = 'Cookie settings' }) {
  const { openSettings } = useConsent()
  return (
    <button type="button" className={`cookie-link ${className}`.trim()} onClick={openSettings}>
      {children}
    </button>
  )
}
