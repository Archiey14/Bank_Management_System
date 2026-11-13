import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import { ArrowRightIcon, LockIcon, TrendUpIcon } from '../components/icons'
import { useAuth } from '../context/authStore'

function PanelCard() {
  return (
    <>
      <div className="panel-card__title">A connected view of your bank</div>
      <div className="panel-card__sub">Everything you need for the day ahead.</div>

      <div className="panel-stats">
        <div className="panel-stats__label">Total deposits</div>
        <div className="panel-stats__row">
          <div className="panel-stats__value">$24,582,890</div>
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

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid work email.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }
    setError('')

    try {
      setSubmitting(true)
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid email or password.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      pill="Your secure workspace"
      headline={['Your bank.', 'All in one place.']}
      description="A clearer view of your operations. A simpler way to serve your customers."
      panelCard={<PanelCard />}
    >
      <div className="auth-eyebrow">Northbank workspace</div>
      <h2 className="auth-title">Welcome back</h2>
      <p className="auth-subtitle">Sign in to manage your banking workspace.</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            className="input"
            type="email"
            placeholder="you@northbank.com"
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
          <a href="#forgot" className="auth-link">
            Forgot password?
          </a>
        </div>

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
          <ArrowRightIcon />
        </button>

        <div className="auth-divider">or continue with</div>

        <button type="button" className="btn-outline">
          <LockIcon />
          Sign in with your organization
        </button>

        <p className="auth-switch">
          New to Northbank?
          <Link to="/signup" className="auth-link">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
