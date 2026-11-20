import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { ArrowRightIcon, ShieldCheckIcon } from '../components/icons'
import { forgotPassword } from '../services/api'

function PanelCard() {
  return (
    <>
      <div className="panel-card__title">Account recovery</div>
      <div className="panel-card__sub">We'll send a reset link to your inbox.</div>
      <div className="panel-stats">
        <div className="panel-stats__label">Reset link expires in</div>
        <div className="panel-stats__row">
          <div className="panel-stats__value">15 min</div>
        </div>
        <div className="panel-stats__grid">
          <div>
            <div className="panel-stats__num">SHA-256</div>
            <div className="panel-stats__cap">Token hashing</div>
          </div>
          <div>
            <div className="panel-stats__num">1×</div>
            <div className="panel-stats__cap">Single use token</div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [directResetUrl, setDirectResetUrl] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await forgotPassword(email.trim().toLowerCase())
      if (res?.resetUrl) {
        setDirectResetUrl(res.resetUrl)
      }
      setSent(true)
    } catch (err) {
      // The backend returns 200 even for unknown emails to prevent enumeration,
      // so a real error here is a network or server fault.
      setError(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      pill="Account recovery"
      headline={['Forgot your', 'password?']}
      description="Enter the email on your account and we'll send you a secure reset link."
      panelCard={<PanelCard />}
    >
      {sent ? (
        <>
          <div className="auth-eyebrow">Check your inbox</div>
          <h2 className="auth-title">Reset link sent</h2>
          <p className="auth-subtitle">
            If <strong>{email}</strong> matches an account, you'll receive a password reset email
            within a few minutes. Check your spam folder if it doesn't arrive.
          </p>
          <p className="auth-subtitle" style={{ marginTop: 16 }}>
            The link expires in <strong>15 minutes</strong>.
          </p>

          {directResetUrl && (
            <div
              style={{
                marginTop: 20,
                padding: '16px 18px',
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: 10,
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 4 }}>
                ⚡ Instant Recovery Link (Direct Access)
              </div>
              <p style={{ fontSize: 13, color: '#15803d', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                You can also use this direct link to set your new password immediately:
              </p>
              <a
                href={directResetUrl}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  textDecoration: 'none',
                  padding: '8px 16px',
                  fontSize: 13,
                }}
              >
                Reset password now
                <ArrowRightIcon />
              </a>
            </div>
          )}

          <p className="auth-switch" style={{ marginTop: 32 }}>
            <Link to="/login" className="auth-link">
              ← Back to sign in
            </Link>
          </p>
        </>
      ) : (
        <>
          <div className="auth-eyebrow">Northbank workspace</div>
          <h2 className="auth-title">Reset your password</h2>
          <p className="auth-subtitle">
            Enter your account email and we'll send you a link to set a new password.
          </p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                className={`input${error ? ' input--error' : ''}`}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
              {error && <div className="field-error">{error}</div>}
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
              <ArrowRightIcon />
            </button>

            <p className="auth-switch">
              <Link to="/login" className="auth-link">
                ← Back to sign in
              </Link>
            </p>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
