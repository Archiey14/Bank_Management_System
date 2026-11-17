import { Link } from 'react-router-dom'
import { COMPANY } from '../config/legal'
import BrandLogo from './BrandLogo'
import CookieSettingsLink from './CookieSettingsLink'
import ThemeToggle from './ThemeToggle'
import './footer.css'

/**
 * Shared footer: Northbank logo, legal links, cookie settings and a theme switch.
 * variant "dark" is for the navy landing page; the default follows the page theme.
 */
export default function SiteFooter({ variant = 'default', id }) {
  return (
    <footer className={`site-footer site-footer--${variant}`} id={id}>
      <div className="site-footer__brand">
        <BrandLogo size={34} tagline={false} variant="footer" label="Northbank home" />
        <span className="site-footer__tag">Banking, thoughtfully connected.</span>
      </div>

      <nav className="site-footer__links" aria-label="Legal and support">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms &amp; Conditions</Link>
        <CookieSettingsLink />
        <a href={`mailto:${COMPANY.supportEmail}`}>Contact support</a>
      </nav>

      <div className="site-footer__side">
        <ThemeToggle />
        <span className="site-footer__copy">© {new Date().getFullYear()} {COMPANY.name}</span>
      </div>
    </footer>
  )
}
