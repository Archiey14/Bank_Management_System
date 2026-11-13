import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authStore'
import {
  ChartIcon,
  CogIcon,
  GridIcon,
  ListIcon,
  LogoutIcon,
  SwapIcon,
  UsersIcon,
  WalletIcon,
} from './appIcons'
import '../pages/dashboard.css'
import '../pages/banking.css'

const MAIN_NAV = [
  { to: '/dashboard', label: 'Overview', icon: <GridIcon /> },
  { to: '/accounts', label: 'Accounts', icon: <WalletIcon /> },
  { to: '/transactions', label: 'Transactions', icon: <ListIcon /> },
  { to: '/transfers', label: 'Transfers', icon: <SwapIcon /> },
]

const STAFF_NAV = [
  { key: 'customers', label: 'Customers', icon: <UsersIcon /> },
  { key: 'reports', label: 'Reports', icon: <ChartIcon /> },
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

  const role = user?.role || 'customer'
  const isStaff = role === 'staff' || role === 'admin'

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

  const showPhaseTwo = (label) => setToast(`${label} arrives with the staff module.`)

  return (
    <div className="db">
      <aside className="db-side">
        <Link to="/dashboard" className="db-logo" aria-label="Northbank home">
          <span className="db-logo__name">northbank</span>
          <span className="db-logo__sub">Banking workspace</span>
        </Link>

        <nav className="db-nav" aria-label="Main">
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `db-nav__item${isActive ? ' is-active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
          {isStaff &&
            STAFF_NAV.map((item) => (
              <button
                key={item.key}
                type="button"
                className="db-nav__item"
                onClick={() => showPhaseTwo(item.label)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          <NavLink
            to="/settings"
            className={({ isActive }) => `db-nav__item${isActive ? ' is-active' : ''}`}
          >
            <CogIcon />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="db-user">
          <span className="db-avatar">{initials(user?.name)}</span>
          <div className="db-user__info">
            <div className="db-user__name">{user?.name || 'Northbank user'}</div>
            <div className="db-user__role">{role}</div>
          </div>
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
          <Link to="/dashboard" className="db-mobilebar__logo">
            northbank
          </Link>
          <button type="button" className="db-btn db-btn--outline" onClick={handleLogout}>
            Sign out
          </button>
        </div>

        <div className="db-mobilenav" role="tablist" aria-label="Sections">
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `db-chiptab${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
          {isStaff &&
            STAFF_NAV.map((item) => (
              <button
                key={item.key}
                type="button"
                className="db-chiptab"
                onClick={() => showPhaseTwo(item.label)}
              >
                {item.label}
              </button>
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
