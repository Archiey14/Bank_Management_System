import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { ArrowRightIcon } from '../components/icons'
import { forgotPassword } from '../services/api'

function PanelCard() {
  return (
    <>
      <div className="panel-card__title">Instant account recovery</div>
      <div className="panel-card__sub">Confirm your registered email to set a new password.</div>
      <div className="panel-stats">
        <div className="panel-stats__label">Security verification</div>
        <div className="panel-stats__row">
          <div className="panel-stats__value">Instant</div>
        </div>
        <div className="panel-stats__grid">
          <div>
            <div className="panel-stats__num">SHA-256</div>
            <div className="panel-stats__cap">Token hashing</div>
          </div>
          <div>
            <div className="panel-stats__num">Direct</div>
            <div className="panel-stats__cap">Secure reset</div>
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
  const navigate = useNavigate()

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
      const token = res?.resetToken || (res?.resetUrl ? res.resetUrl.split('/reset-password/')[1] : null)
      if (token) {
        // Navigate directly to the password change screen
        navigate(`/reset-password/${token}`)
        return
      }
      setError('No account matches this email address. Please check and try again.')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      pill="Account recovery"
      headline={['Forgot your', 'password?']}
      description="Enter your account email to proceed directly to setting a new password."
      panelCard={<PanelCard />}
    >
      <div className="auth-eyebrow">Northbank workspace</div>
      <h2 className="auth-title">Reset your password</h2>
      <p className="auth-subtitle">
        Enter your registered account email to choose a new password.
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
          {submitting ? 'Verifying account…' : 'Continue to set new password'}
          <ArrowRightIcon />
        </button>

        <p className="auth-switch">
          <Link to="/login" className="auth-link">
            ← Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
