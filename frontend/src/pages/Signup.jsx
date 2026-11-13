import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import { ArrowRightIcon, CheckIcon } from '../components/icons'
import { useAuth } from '../context/authStore'

const FEATURES = [
  { title: 'Accounts & transactions', text: 'Keep daily operations connected.' },
  { title: 'Customers & compliance', text: 'Bring service and reviews together.' },
  { title: 'Insights & reporting', text: 'Turn banking activity into clarity.' },
]

function PanelCard() {
  return (
    <>
      <div className="panel-card__title">One workspace. Every team.</div>
      <div className="panel-card__sub">Make room for better ways of working.</div>
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
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Enter your full name.')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email.')
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
      pill="Built for your team"
      headline={['Better banking.', 'Built together.']}
      description="Give your team one place to manage accounts, serve customers, and keep banking moving."
      panelCard={<PanelCard />}
    >
      <div className="auth-eyebrow">Northbank workspace</div>
      <h2 className="auth-title">Create your account</h2>
      <p className="auth-subtitle">Set up your access to a more connected bank.</p>

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
          <label htmlFor="email">Email</label>
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
            <a href="#terms" className="auth-link">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#privacy" className="auth-link">
              Privacy Policy
            </a>
          </span>
        </label>

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create account'}
          <ArrowRightIcon />
        </button>

        <p className="auth-note">Your administrator may need to approve workspace access.</p>

        <p className="auth-switch">
          Already have an account?
          <Link to="/login" className="auth-link">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
