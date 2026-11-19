import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import { ArrowRightIcon, CheckIcon, GoogleIcon } from '../components/icons'
import { useAuth } from '../context/authStore'

const FEATURES = [
  { title: 'Personal accounts', text: 'Open savings and current accounts in minutes.' },
  { title: 'Instant transfers', text: 'Send and receive money seamlessly across accounts.' },
  { title: 'High-yield deposits', text: 'Grow your savings with flexible fixed deposits.' },
]

function PanelCard() {
  return (
    <>
      <div className="panel-card__title">Simple, transparent banking.</div>
      <div className="panel-card__sub">Built for how you manage your money today.</div>
      <ul className="panel-list">
        {FEATURES.map((f) => (
          <li key={f.title}>
            <span className="panel-list__check">
              <CheckIcon />
            </span>
            <div>
              <div className="panel-list__title">{f.title}</div>
              <div className="panel-list__text">{f.text}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function Signup() {
  const { register, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleGoogleSignIn = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      const user = await signInWithGoogle(true)
      if (user.role === 'admin') navigate('/admin')
      else if (user.role === 'staff') navigate('/staff')
      else navigate('/dashboard')
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        return
      }
      setError(
        err.response?.data?.message || err.message || 'Google sign-up failed. Please try again.'
      )
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Enter your full name.')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.')
    if (form.password.length < 6 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password) || !/[^A-Za-z0-9]/.test(form.password)) {
      return setError('Password needs at least 6 characters with a letter, number, and symbol.')
    }
    if (!agree) return setError('Please accept the Terms of Service and Privacy Policy.')
    setError('')

    try {
      setSubmitting(true)
      await register(form.name.trim(), form.email.trim(), form.password, form.password)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      pill="Personal digital banking"
      headline={['Better banking.', 'Built for you.']}
      description="Enjoy fast transfers, clear account overviews, and modern banking from any device."
      panelCard={<PanelCard />}
    >
      <div className="auth-eyebrow">Northbank Digital Banking</div>
      <h2 className="auth-title">Create your account</h2>
      <p className="auth-subtitle">Join Northbank and experience modern, connected banking.</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            className="input"
            type="text"
            placeholder="Enter your full name"
            autoComplete="name"
            value={form.name}
            onChange={update('name')}
          />
        </div>

        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            className="input"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <PasswordField
            id="password"
            placeholder="Create a password"
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
          />
          <div className="field-hint">Use at least 6 characters with a letter, number, and symbol.</div>
          {error && <div className="field-error">{error}</div>}
        </div>

        <label className="check check--terms">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            I agree to the{' '}
            <Link to="/terms" className="auth-link">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="auth-link">
              Privacy Policy
            </Link>
          </span>
        </label>

        <button type="submit" className="btn-primary" disabled={submitting || googleLoading}>
          {submitting ? 'Creating account...' : 'Create account'}
          <ArrowRightIcon />
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleSignIn}
          disabled={submitting || googleLoading}
        >
          <GoogleIcon />
          <span>{googleLoading ? 'Connecting to Google…' : 'Sign up with Google'}</span>
        </button>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
