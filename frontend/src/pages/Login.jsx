import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'

import PasswordField from '../components/PasswordField'
import { ArrowRightIcon, TrendUpIcon } from '../components/icons'
import { useAuth } from '../context/authStore'

function PanelCard() {
  return (
    <>
      <div className="panel-card__title">A connected view of your bank</div>
      <div className="panel-card__sub">Everything you need for the day ahead.</div>

      <div className="panel-stats">
        <div className="panel-stats__label">Total deposits</div>
        <div className="panel-stats__row">
          <div className="panel-stats__value">₹24.58 Cr</div>
          <span className="panel-badge">
            <TrendUpIcon /> 8.2% this month
          </span>
        </div>
        <div className="panel-stats__grid">
          <div>
            <div className="panel-stats__num">18,492</div>
            <div className="panel-stats__cap">Active accounts</div>
          </div>
          <div>
            <div className="panel-stats__num">1,284</div>
            <div className="panel-stats__cap">Transactions today</div>
          </div>
        </div>
      </div>
    </>
  )
}

// Mask the email so the code step can confirm where the code was sent without
// echoing the full address on a shared screen.
const maskEmail = (email = '') => {
  const [name, domain] = email.split('@')
  if (!domain) return email
  const visible = name.slice(0, Math.min(2, name.length))
  return `${visible}${'•'.repeat(Math.max(name.length - 2, 2))}@${domain}`
}

export default function Login() {
  const { login, verifyLoginOtp } = useAuth()
  const navigate = useNavigate()

  // Step 1 — credentials
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [info, setInfo] = useState('')

  // Step 2 — email OTP (only when otpRequired is true)
  const [otpToken, setOtpToken] = useState(null)
  const [otpRemember, setOtpRemember] = useState(true)
  const [code, setCode] = useState('')
  const [resending, setResending] = useState(false)

  const inOtpStep = Boolean(otpToken)

  // Go back to credentials and optionally show a message
  const resetToCredentials = (message = '') => {
    setOtpToken(null)
    setCode('')
    setPassword('')
    setError(message)
    setInfo('')
  }

  // ── Step 1: email + password ──────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }
    setError('')

    try {
      setSubmitting(true)
      const result = await login(email, password, remember)
      if (result.otpRequired) {
        setOtpToken(result.otpToken)
        setOtpRemember(remember)
        setInfo(`We sent a 6-digit code to ${maskEmail(email)}. It expires in 10 minutes.`)
        return
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  // Resend a fresh code by re-running step 1 (password is still in state).
  const handleResend = async () => {
    setError('')
    try {
      setResending(true)
      const result = await login(email, password, otpRemember)
      if (result.otpRequired) {
        setOtpToken(result.otpToken)
        setInfo(`A new code was sent to ${maskEmail(email)}.`)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend the code. Try again.')
    } finally {
      setResending(false)
    }
  }

  // ── Step 2: enter the emailed code ───────────────────────────────────────
  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    const value = code.trim()
    if (!/^\d{6}$/.test(value)) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setError('')

    try {
      setSubmitting(true)
      await verifyLoginOtp(otpToken, value, otpRemember)
      navigate('/dashboard')
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.message || 'Could not verify your code. Try again.'
      // 401/429 that isn't a plain wrong/locked code means the 10-minute window
      // ran out — go back to credentials.
      if (
        (status === 401 && msg !== 'Invalid verification code') ||
        status === 429
      ) {
        resetToCredentials(msg)
      } else {
        setError(msg)
        setCode('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCodeChange = (e) => {
    setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AuthLayout
      pill="Your secure workspace"
      headline={['Your bank.', 'All in one place.']}
      description="A clearer view of your operations. A simpler way to serve your customers."
      panelCard={<PanelCard />}
    >
      {inOtpStep ? (
        /* ── Email OTP code entry ── */
        <>
          <div className="auth-eyebrow">Two-step verification</div>
          <h2 className="auth-title">Enter your code</h2>
          <p className="auth-subtitle">{info}</p>

          <form className="auth-form" onSubmit={handleCodeSubmit} noValidate>
            <div className="field">
              <label htmlFor="login-otp-code">Sign-in code</label>
              <input
                id="login-otp-code"
                className={`input input--code${error ? ' input--error' : ''}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={handleCodeChange}
                autoFocus
              />
              {error && <div className="field-error">{error}</div>}
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Verifying…' : 'Verify and sign in'}
              <ArrowRightIcon />
            </button>

            <p className="auth-switch">
              <button
                type="button"
                className="auth-linkbtn"
                onClick={handleResend}
                disabled={resending || submitting}
              >
                {resending ? 'Sending…' : "Didn't get the code? Resend it"}
              </button>
            </p>
            <p className="auth-switch" style={{ marginTop: 8 }}>
              <button type="button" className="auth-linkbtn" onClick={() => resetToCredentials()}>
                ← Back to sign in
              </button>
            </p>
          </form>
        </>
      ) : (
        /* ── Credentials form ── */
        <>
          <div className="auth-eyebrow">Northbank workspace</div>
          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-subtitle">Sign in to manage your banking workspace.</p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <PasswordField
                id="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <div className="field-error">{error}</div>}
            </div>

            <div className="auth-row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
              <ArrowRightIcon />
            </button>

            <p className="auth-switch">
              New to Northbank?{' '}
              <Link to="/signup" className="auth-link">
                Create an account
              </Link>
            </p>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
