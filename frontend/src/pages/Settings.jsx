import { useState } from 'react'
import { useAuth } from '../context/authStore'
import { useTheme } from '../hooks/useTheme'
import { useConsent } from '../context/consentStore'
import AppShell, { PageHeader } from '../components/AppShell'
import PasswordField from '../components/PasswordField'
import { changePassword, updateProfile } from '../services/api'
import { formatDate } from '../utils/format'
import { MoonIcon, SunIcon } from '../components/appIcons'
import { ShieldCheckIcon } from '../components/icons'

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' }

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
]

const isStrongPassword = (value) =>
  value.length >= 6 &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value)

export default function Settings() {
  const { user, updateUser } = useAuth()
  const { theme, preference, setPreference } = useTheme()
  const { consent, openSettings } = useConsent()

  // Profile state
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [avatar, setAvatar] = useState(user?.avatar || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileNotice, setProfileNotice] = useState('')

  // Password state
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

    if (phone.trim() && !/^[0-9+() -]{7,20}$/.test(phone.trim())) {
      setProfileError('Please enter a valid phone number (7-20 digits).')
      return
    }

    setProfileSaving(true)
    try {
      const data = await updateProfile({
        name: trimmed,
        phone: phone.trim(),
        avatar: avatar.trim(),
      })
      updateUser(data.user)
      setName(data.user.name)
      setPhone(data.user.phone || '')
      setAvatar(data.user.avatar || '')
      setProfileNotice('Profile updated successfully.')
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
        eyebrow="Account &amp; Workspace"
        title="Settings &amp; Profile"
        sub="Personalize your banking profile, choose your theme mode, and manage credentials and cookie preferences."
      />

      <div className="db-page-grid">
        {/* Profile Card */}
        <section className="db-card">
          <div className="db-card__head">
            <div>
              <h2 className="db-card__title">Edit Profile</h2>
              <p className="db-card__sub">Update your name, contact phone, and avatar.</p>
            </div>
          </div>

          <form className="db-form" onSubmit={handleProfile}>
            <div className="field">
              <label htmlFor="profile-name">Full Name</label>
              <input
                id="profile-name"
                className="input"
                type="text"
                maxLength={80}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="field">
              <label htmlFor="profile-phone">Phone Number</label>
              <input
                id="profile-phone"
                className="input"
                type="tel"
                placeholder="+91 9876543210"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
              />
              <div className="field-hint">Used for banking transaction notifications.</div>
            </div>

            <div className="field">
              <label>Profile Picture / Avatar</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                {AVATAR_PRESETS.map((preset, idx) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAvatar(preset)}
                    style={{
                      border: avatar === preset ? '2px solid #6468cc' : '2px solid transparent',
                      padding: 2,
                      borderRadius: '50%',
                      background: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <img
                      src={preset}
                      alt={`Avatar option ${idx + 1}`}
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
                {avatar && (
                  <button
                    type="button"
                    className="db-btn db-btn--outline"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    onClick={() => setAvatar('')}
                  >
                    Clear Avatar
                  </button>
                )}
              </div>
            </div>

            <div className="field">
              <label htmlFor="profile-email">Email Address</label>
              <input
                id="profile-email"
                className="input"
                type="email"
                value={user?.email || ''}
                readOnly
                disabled
              />
              <div className="field-hint">Primary account identifier cannot be altered directly.</div>
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
                {profileSaving ? 'Saving…' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </section>

        {/* Password Card */}
        <section className="db-card">
          <div className="db-card__head">
            <div>
              <h2 className="db-card__title">Security Credentials</h2>
              <p className="db-card__sub">Use at least 6 characters with a letter, number and symbol.</p>
            </div>
          </div>

          <form className="db-form" onSubmit={handlePassword}>
            <div className="field">
              <label htmlFor="current-password">Current Password</label>
              <PasswordField
                id="current-password"
                value={passwords.currentPassword}
                onChange={updatePassword('currentPassword')}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </div>

            <div className="field">
              <label htmlFor="new-password">New Password</label>
              <PasswordField
                id="new-password"
                value={passwords.newPassword}
                onChange={updatePassword('newPassword')}
                placeholder="Enter new strong password"
                autoComplete="new-password"
              />
            </div>

            <div className="field">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <PasswordField
                id="confirm-password"
                value={passwords.confirmPassword}
                onChange={updatePassword('confirmPassword')}
                placeholder="Repeat new password"
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
                {passwordSaving ? 'Changing…' : 'Change Password'}
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="db-card" style={{ marginTop: 20 }}>
        <div className="db-card__head">
          <div>
            <h2 className="db-card__title">Two-Step Verification</h2>
            <p className="db-card__sub">
              Every login requires a 6-digit one-time code sent directly to your registered email address.
            </p>
          </div>
          <span className="pill pill--completed">Active</span>
        </div>
        <p className="db-form__hint" style={{ marginTop: 12 }}>
          Codes expire in 5 minutes and are single-use. No authenticator app required.
        </p>
      </section>

      <div className="db-page-grid" style={{ marginTop: 20 }}>
        {/* Theme Customization Card */}
        <section className="db-card">
          <div className="db-card__head">
            <div>
              <h2 className="db-card__title">Theme Customization</h2>
              <p className="db-card__sub">
                Choose how Northbank looks on your screen. Persisted across sessions.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
            <button
              type="button"
              className={`db-btn ${preference === 'light' ? 'db-btn--primary' : 'db-btn--outline'}`}
              style={{ display: 'flex', flexDirection: 'column', height: 'auto', padding: '16px 12px', gap: 8 }}
              onClick={() => setPreference('light')}
            >
              <SunIcon size={20} />
              <span style={{ fontWeight: 600 }}>Light Mode</span>
            </button>

            <button
              type="button"
              className={`db-btn ${preference === 'dark' ? 'db-btn--primary' : 'db-btn--outline'}`}
              style={{ display: 'flex', flexDirection: 'column', height: 'auto', padding: '16px 12px', gap: 8 }}
              onClick={() => setPreference('dark')}
            >
              <MoonIcon size={20} />
              <span style={{ fontWeight: 600 }}>Dark Mode</span>
            </button>

            <button
              type="button"
              className={`db-btn ${preference === 'system' ? 'db-btn--primary' : 'db-btn--outline'}`}
              style={{ display: 'flex', flexDirection: 'column', height: 'auto', padding: '16px 12px', gap: 8 }}
              onClick={() => setPreference('system')}
            >
              <ShieldCheckIcon size={20} />
              <span style={{ fontWeight: 600 }}>System Default</span>
            </button>
          </div>
          <p className="db-form__hint" style={{ marginTop: 12 }}>
            Currently active theme: <strong style={{ textTransform: 'capitalize' }}>{theme}</strong> (
            {preference === 'system' ? 'Matches your operating system color scheme' : `${preference} preference stored`}
            ).
          </p>
        </section>

        {/* Cookie Policy & Preferences Card */}
        <section className="db-card">
          <div className="db-card__head">
            <div>
              <h2 className="db-card__title">Cookie &amp; Privacy Preferences</h2>
              <p className="db-card__sub">Review and update tracking and cookie consents.</p>
            </div>
          </div>

          <dl className="db-kv" style={{ marginTop: 12 }}>
            <div>
              <dt>Necessary Cookies</dt>
              <dd>
                <span className="pill pill--completed">Active</span>
              </dd>
            </div>
            <div>
              <dt>Functional &amp; Theme</dt>
              <dd>
                <span className={`pill ${consent?.functional ? 'pill--completed' : 'pill--pending'}`}>
                  {consent?.functional ? 'Enabled' : 'Disabled'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Analytics Cookies</dt>
              <dd>
                <span className={`pill ${consent?.analytics ? 'pill--completed' : 'pill--pending'}`}>
                  {consent?.analytics ? 'Enabled' : 'Disabled'}
                </span>
              </dd>
            </div>
          </dl>

          <div className="db-form__actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="db-btn db-btn--outline"
              onClick={openSettings}
            >
              Manage Cookie Preferences
            </button>
          </div>
        </section>
      </div>

      {/* Read-Only Account Details */}
      <section className="db-card" style={{ marginTop: 20 }}>
        <div className="db-card__head">
          <div>
            <h2 className="db-card__title">Account Identity &amp; System Role</h2>
            <p className="db-card__sub">Managed by bank security — strictly read only.</p>
          </div>
          <span className="db-chip" style={{ textTransform: 'uppercase', fontWeight: 700 }}>
            {user?.role}
          </span>
        </div>

        <dl className="db-kv">
          <div>
            <dt>Email Address</dt>
            <dd>{user?.email || '—'}</dd>
          </div>
          <div>
            <dt>Role &amp; Permissions</dt>
            <dd style={{ textTransform: 'capitalize' }}>{user?.role}</dd>
          </div>
          <div>
            <dt>Email Verification</dt>
            <dd>{user?.isEmailVerified ? 'Verified' : 'Pending'}</dd>
          </div>
          <div>
            <dt>Customer Since</dt>
            <dd>{formatDate(user?.createdAt)}</dd>
          </div>
          <div>
            <dt>Last Sign-In</dt>
            <dd>{user?.lastLogin ? formatDate(user.lastLogin) : 'Just now'}</dd>
          </div>
          <div>
            <dt>Base Currency</dt>
            <dd>INR (₹)</dd>
          </div>
        </dl>
      </section>
    </AppShell>
  )
}
