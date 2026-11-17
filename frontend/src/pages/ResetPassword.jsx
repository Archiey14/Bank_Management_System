import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import { ArrowRightIcon } from '../components/icons'
import { resetPassword } from '../services/api'

function PanelCard() {
  return (
    <>
      <div className="panel-card__title">Choose a strong password</div>
      <div className="panel-card__sub">At least 6 characters with a letter, number, and symbol.</div>
      <div className="panel-stats">
        <div className="panel-stats__label">Requirements</div>
        <div className="panel-stats__grid" style={{ marginTop: 14 }}>
          <div>
            <div className="panel-stats__num">6+</div>
            <div className="panel-stats__cap">Characters minimum</div>
          </div>
          <div>
            <div className="panel-stats__num">bcrypt</div>
            <div className="panel-stats__cap">Stored securely</div>
          </div>
        </div>
      </div>
    </>
  )
}

const isStrong = (p) =>
  p.length >= 6 && /[A-Za-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p)

export default function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isStrong(password)) {
      setError('Password needs at least 6 characters with a letter, number, and symbol.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await resetPassword({ token, password, confirmPassword: confirm })
      setDone(true)
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Could not reset your password. The link may have expired.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      pill="Account recovery"
      headline={['Set a new', 'password.']}
      description="Choose a strong password you haven't used before."
      panelCard={<PanelCard />}
    >
      {done ? (
        <>
          <div className="auth-eyebrow">All done</div>
          <h2 className="auth-title">Password updated</h2>
          <p className="auth-subtitle">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <div style={{ marginTop: 32 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate('/login')}
            >
              Sign in
              <ArrowRightIcon />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="auth-eyebrow">Northbank workspace</div>
          <h2 className="auth-title">Choose a new password</h2>
          <p className="auth-subtitle">
            Pick something you haven't used before. The reset link expires 15 minutes after it
            was sent.
          </p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="password">New password</label>
              <PasswordField
                id="password"
                placeholder="Create a strong password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <div className="field-hint">
                At least 6 characters with a letter, number, and symbol.
              </div>
            </div>

            <div className="field">
              <label htmlFor="confirm">Confirm new password</label>
              <PasswordField
                id="confirm"
                placeholder="Repeat your new password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {error && <div className="field-error">{error}</div>}
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Set new password'}
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
