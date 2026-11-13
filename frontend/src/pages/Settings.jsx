import { useState } from 'react'
import { useAuth } from '../context/authStore'
import AppShell, { PageHeader } from '../components/AppShell'
import PasswordField from '../components/PasswordField'
import { changePassword, updateProfile } from '../services/api'
import { formatDate } from '../utils/format'

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' }

const isStrongPassword = (value) =>
  value.length >= 6 &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value)

export default function Settings() {
  const { user, updateUser } = useAuth()

  const [name, setName] = useState(user?.name || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileNotice, setProfileNotice] = useState('')

  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')

  const updatePassword = (key) => (event) => {
    setPasswords((current) => ({ ...current, [key]: event.target.value }))
  }

  const handleProfile = async (event) => {
    event.preventDefault()
    setProfileError('')
    setProfileNotice('')

    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 80) {
      setProfileError('Name must be between 2 and 80 characters.')
      return
    }

    setProfileSaving(true)
    try {
      const data = await updateProfile(trimmed)
      updateUser(data.user)
      setName(data.user.name)
      setProfileNotice('Profile updated.')
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Could not update your profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePassword = async (event) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordNotice('')

    if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
      setPasswordError('Fill in all three password fields.')
      return
    }
    if (!isStrongPassword(passwords.newPassword)) {
      setPasswordError(
        'New password needs at least 6 characters with a letter, a number and a symbol.'
      )
      return
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }
    if (passwords.newPassword === passwords.currentPassword) {
      setPasswordError('New password must be different from the current one.')
      return
    }

    setPasswordSaving(true)
    try {
      await changePassword(passwords)
      setPasswords(EMPTY_PASSWORDS)
      setPasswordNotice('Password changed. Use it the next time you sign in.')
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Could not change your password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Your workspace"
        title="Settings"
        sub="Keep your details and sign-in credentials up to date."
      />

      <div className="db-page-grid">
        <section className="db-card">
          <div className="db-card__head">
            <div>
              <h2 className="db-card__title">Profile</h2>
              <p className="db-card__sub">This is the name shown across your workspace.</p>
            </div>
          </div>

          <form className="db-form" onSubmit={handleProfile}>
            <div className="field">
              <label htmlFor="profile-name">Full name</label>
              <input
                id="profile-name"
                className="input"
                type="text"
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="field">
              <label htmlFor="profile-email">Email</label>
              <input
                id="profile-email"
                className="input"
                type="email"
                value={user?.email || ''}
                readOnly
                disabled
              />
              <div className="field-hint">Email changes are handled by the bank.</div>
            </div>

            {profileError && (
              <div className="db-alert db-alert--error" role="alert">
                {profileError}
              </div>
            )}
            {profileNotice && (
              <div className="db-alert db-alert--success" role="status">
                {profileNotice}
              </div>
            )}

            <div className="db-form__actions">
              <button type="submit" className="db-btn db-btn--primary" disabled={profileSaving}>
                {profileSaving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </section>

        <section className="db-card">
          <div className="db-card__head">
            <div>
              <h2 className="db-card__title">Password</h2>
              <p className="db-card__sub">Use at least 6 characters with a letter, number and symbol.</p>
            </div>
          </div>

          <form className="db-form" onSubmit={handlePassword}>
            <div className="field">
              <label htmlFor="current-password">Current password</label>
              <PasswordField
                id="current-password"
                value={passwords.currentPassword}
                onChange={updatePassword('currentPassword')}
                placeholder="Enter your current password"
                autoComplete="current-password"
              />
            </div>

            <div className="field">
              <label htmlFor="new-password">New password</label>
              <PasswordField
                id="new-password"
                value={passwords.newPassword}
                onChange={updatePassword('newPassword')}
                placeholder="Enter a new password"
                autoComplete="new-password"
              />
            </div>

            <div className="field">
              <label htmlFor="confirm-password">Confirm new password</label>
              <PasswordField
                id="confirm-password"
                value={passwords.confirmPassword}
                onChange={updatePassword('confirmPassword')}
                placeholder="Repeat the new password"
                autoComplete="new-password"
              />
            </div>

            {passwordError && (
              <div className="db-alert db-alert--error" role="alert">
                {passwordError}
              </div>
            )}
            {passwordNotice && (
              <div className="db-alert db-alert--success" role="status">
                {passwordNotice}
              </div>
            )}

            <div className="db-form__actions">
              <button type="submit" className="db-btn db-btn--primary" disabled={passwordSaving}>
                {passwordSaving ? 'Changing…' : 'Change password'}
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="db-card" style={{ marginTop: 20 }}>
        <div className="db-card__head">
          <div>
            <h2 className="db-card__title">Account details</h2>
            <p className="db-card__sub">Managed by the bank — read only.</p>
          </div>
          <span className="db-chip">{user?.role}</span>
        </div>

        <dl className="db-kv">
          <div>
            <dt>Email</dt>
            <dd>{user?.email || '—'}</dd>
          </div>
          <div>
            <dt>Email status</dt>
            <dd>{user?.isEmailVerified ? 'Verified' : 'Not verified'}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{formatDate(user?.createdAt)}</dd>
          </div>
          <div>
            <dt>Last sign-in</dt>
            <dd>{user?.lastLogin ? formatDate(user.lastLogin) : 'Just now'}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>Stateless JWT</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>INR</dd>
          </div>
        </dl>
      </section>
    </AppShell>
  )
}
