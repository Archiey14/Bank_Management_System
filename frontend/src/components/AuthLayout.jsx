import { Link } from 'react-router-dom'
import './auth.css'
import { ShieldCheckIcon } from './icons'

/**
 * Shared split-screen shell for the Login and Signup pages.
 * Left: navy brand panel. Right: the form (passed as children).
 */
export default function AuthLayout({ pill, headline, description, panelCard, children }) {
  return (
    <div className="auth">
      <aside className="auth-brand">
        <div className="auth-brand__dots" aria-hidden="true" />

        <Link to="/" className="auth-brand__top" aria-label="Northbank home">
          <div className="auth-logo">northbank</div>
          <div className="auth-logo__sub">Banking workspace</div>
        </Link>

        <div className="auth-brand__middle">
          <span className="auth-pill">{pill}</span>
          <h1 className="auth-headline">
            {headline.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <p className="auth-description">{description}</p>

          <div className="auth-panel-card">{panelCard}</div>
        </div>

        <div className="auth-secure">
          <span className="auth-secure__icon">
            <ShieldCheckIcon size={18} />
          </span>
          <div>
            <div className="auth-secure__title">A secure space for your team</div>
            <div className="auth-secure__text">Role-based access. Built around your operations.</div>
          </div>
        </div>

        <div className="auth-brand__footer">
          <span>© 2026 Northbank</span>
          <span>Banking, thoughtfully connected.</span>
        </div>
      </aside>

      <main className="auth-form-side">
        <div className="auth-form-side__top">
          <span>Need a hand?</span>
          <a href="#support">Contact support</a>
        </div>

        <div className="auth-form-wrap">{children}</div>

        <div className="auth-form-side__footer">
          <div className="auth-form-side__links">
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
          </div>
          <div className="auth-form-side__secure">
            <ShieldCheckIcon size={14} />
            <span>Secure workspace access</span>
          </div>
        </div>
      </main>
    </div>
  )
}
