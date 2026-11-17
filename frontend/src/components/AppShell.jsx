import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authStore'
import { useTheme } from '../hooks/useTheme'
import {
  CardIcon,
  ClockIcon,
  CogIcon,
  DepositIcon,
  FileIcon,
  GridIcon,
  ListIcon,
  LogoutIcon,
  MoonIcon,
  SunIcon,
  SwapIcon,
  UsersIcon,
  WalletIcon,
} from './appIcons'
import { ShieldCheckIcon } from './icons'
import BrandLogo from './BrandLogo'
import '../pages/dashboard.css'
import '../pages/banking.css'
import '../pages/cards.css'

const CUSTOMER_NAV = [
  { to: '/dashboard', label: 'Dashboard Overview', icon: <GridIcon /> },
  { to: '/accounts', label: 'My Bank Accounts', icon: <WalletIcon /> },
  { to: '/cards/debit', label: 'Debit Cards', icon: <CardIcon /> },
  { to: '/cards/credit', label: 'Credit Cards', icon: <CardIcon />, end: true },
  { to: '/cards/credit/apply', label: 'Credit Card Application', icon: <FileIcon /> },
  { to: '/transfers', label: 'Send Money & Payees', icon: <SwapIcon /> },
  { to: '/deposits', label: 'Deposits & Withdrawals', icon: <DepositIcon /> },
  { to: '/fixed-deposits', label: 'Fixed Term Deposits', icon: <ClockIcon /> },
  { to: '/transactions', label: 'Ledger & Statements', icon: <ListIcon /> },
]

const STAFF_NAV = [
  { to: '/staff', label: 'Operations desk', icon: <UsersIcon />, end: true },
  { to: '/accounts', label: 'Accounts directory', icon: <WalletIcon /> },
  { to: '/transactions', label: 'Transactions ledger', icon: <ListIcon /> },
  { to: '/staff/card-desk', label: 'Card desk', icon: <CardIcon /> },
]

const ADMIN_NAV = [
  { to: '/admin', label: 'Admin portal', icon: <ShieldCheckIcon /> },
  { to: '/staff', label: 'Staff desk', icon: <UsersIcon />, end: true },
  { to: '/accounts', label: 'Accounts directory', icon: <WalletIcon /> },
  { to: '/transactions', label: 'Audit & Ledger', icon: <ListIcon /> },
  { to: '/staff/card-desk', label: 'Card desk', icon: <CardIcon /> },
]

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'NB'

export function PageHeader({ eyebrow, title, sub, actions }) {
  return (
    <header className="db-head">
      <div>
        {eyebrow && <div className="db-eyebrow">{eyebrow}</div>}
        <h1 className="db-title">{title}</h1>
        {sub && <p className="db-sub">{sub}</p>}
      </div>
      {actions && <div className="db-head__actions">{actions}</div>}
    </header>
  )
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')
  const { theme, toggleTheme } = useTheme()

  const role = user?.role || 'customer'

  const navItems = role === 'admin' ? ADMIN_NAV : role === 'staff' ? STAFF_NAV : CUSTOMER_NAV

  const homeLink = role === 'admin' ? '/admin' : role === 'staff' ? '/staff' : '/dashboard'

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/login')
    }
  }

  return (
    <div className="db">
      <aside className="db-side">
        <BrandLogo
          to={homeLink}
          size={40}
          variant="side"
          subtitle={role === 'admin' ? 'Admin Portal' : role === 'staff' ? 'Staff Desk' : 'Digital Banking'}
        />

        <nav className="db-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `db-nav__item${isActive ? ' is-active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            className={({ isActive }) => `db-nav__item${isActive ? ' is-active' : ''}`}
          >
            <CogIcon />
            <span>Profile &amp; Settings</span>
          </NavLink>
        </nav>

        <div className="db-user">
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="db-avatar" style={{ objectFit: 'cover' }} />
          ) : (
            <span className="db-avatar">{initials(user?.name)}</span>
          )}
          <div className="db-user__info">
            <div className="db-user__name">{user?.name || 'Northbank user'}</div>
            <div className="db-user__role" style={{ textTransform: 'capitalize' }}>
              {role}
            </div>
          </div>
          <button
            type="button"
            className="db-user__out"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            type="button"
            className="db-user__out"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      <div className="db-main">
        <div className="db-mobilebar">
          <BrandLogo to={homeLink} size={30} tagline={false} variant="hero" className="db-mobilebar__logo" />
          <div className="db-mobilebar__actions">
            <button
              type="button"
              className="db-btn db-btn--outline"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button type="button" className="db-btn db-btn--outline" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>

        <div className="db-mobilenav" role="tablist" aria-label="Sections">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `db-chiptab${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            className={({ isActive }) => `db-chiptab${isActive ? ' is-active' : ''}`}
          >
            Settings
          </NavLink>
        </div>

        <div className="db-content">{children}</div>
      </div>

      {toast && (
        <div className="db-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
