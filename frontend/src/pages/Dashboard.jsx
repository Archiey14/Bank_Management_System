import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TrendUpIcon, CheckIcon, ArrowRightIcon } from '../components/icons'
import './dashboard.css'

/* ---------- Local icon set (same stroke style as the landing page) ---------- */
const Icon = ({ children, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const GridIcon = () => (
  <Icon>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
  </Icon>
)
const WalletIcon = () => (
  <Icon>
    <path d="M3 7a2 2 0 012-2h13v4" />
    <path d="M3 7v11a2 2 0 002 2h15a1 1 0 001-1V10a1 1 0 00-1-1H5a2 2 0 01-2-2z" />
    <circle cx="16.5" cy="14.5" r="1.2" />
  </Icon>
)
const SwapIcon = () => (
  <Icon>
    <path d="M4 8h14M14 4l4 4-4 4" />
    <path d="M20 16H6M10 12l-4 4 4 4" />
  </Icon>
)
const ListIcon = () => (
  <Icon>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </Icon>
)
const ChartIcon = () => (
  <Icon>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6" />
  </Icon>
)
const UsersIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M16 5.2a3.2 3.2 0 010 5.6M18 14.4c2 .7 3 2.6 3 5.6" />
  </Icon>
)
const CogIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
  </Icon>
)
const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
const ReceiptIcon = () => (
  <Icon>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
    <path d="M9 8h6M9 12h6" />
  </Icon>
)
const FileIcon = () => (
  <Icon>
    <path d="M7 3h7l5 5v13H7V3z" />
    <path d="M14 3v5h5M10 13h6M10 17h4" />
  </Icon>
)
const LogoutIcon = () => (
  <Icon size={16}>
    <path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4" />
    <path d="M16 8l4 4-4 4M20 12H9" />
  </Icon>
)
const ArrowDownIcon = () => (
  <Icon size={14}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
)
const ArrowUpIcon = () => (
  <Icon size={14}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
)

/* ---------- Sample data (replace with API calls when the banking endpoints exist) ---------- */
const accounts = [
  { name: 'Savings', num: '8492', balance: 14250.0 },
  { name: 'Current', num: '3107', balance: 6820.45 },
  { name: 'Fixed deposit', num: '5521', balance: 25000.0 },
]

const transactions = [
  { id: 1, title: 'Salary', sub: 'Northbank Payroll', amount: 4200.0, date: 'Nov 10', status: 'Completed' },
  { id: 2, title: 'Electricity bill', sub: 'Grid Energy', amount: -182.4, date: 'Nov 9', status: 'Completed' },
  { id: 3, title: 'Transfer to Riya S.', sub: 'Current •••• 3107', amount: -500.0, date: 'Nov 8', status: 'Completed' },
  { id: 4, title: 'Groceries', sub: 'FreshMart', amount: -96.35, date: 'Nov 8', status: 'Completed' },
  { id: 5, title: 'Interest credit', sub: 'Savings •••• 8492', amount: 38.12, date: 'Nov 7', status: 'Completed' },
  { id: 6, title: 'Rent', sub: 'Scheduled payment', amount: -1250.0, date: 'Nov 5', status: 'Pending' },
]

const cashflow = [
  { m: 'Jun', in: 5.2, out: 3.1 },
  { m: 'Jul', in: 5.6, out: 3.4 },
  { m: 'Aug', in: 5.1, out: 2.9 },
  { m: 'Sep', in: 6.0, out: 3.8 },
  { m: 'Oct', in: 5.8, out: 3.3 },
  { m: 'Nov', in: 8.4, out: 3.2 },
]

const trend = [38.2, 39.1, 38.7, 40.9, 42.3, 44.8, 46.1]

const quickActions = [
  { label: 'Transfer', hint: 'Move money', icon: <SwapIcon />, note: 'Transfers' },
  { label: 'Deposit', hint: 'Add funds', icon: <PlusIcon />, note: 'Deposits' },
  { label: 'Pay bills', hint: 'Utilities & more', icon: <ReceiptIcon />, note: 'Bill payments' },
  { label: 'Statements', hint: 'Download PDF', icon: <FileIcon />, note: 'Statements' },
]

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const fmt = (n) => money.format(n)

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function initials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'NB'
  )
}

function Sparkline({ values }) {
  const w = 320
  const h = 64
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - 6 - ((v - min) / (max - min)) * (h - 14)
    return [x, y]
  })
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `0,${h} ${line} ${w},${h}`
  return (
    <svg className="db-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="dbSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a9b4ff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#a9b4ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#dbSparkFill)" />
      <polyline points={line} fill="none" stroke="#c7ceff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')

  const role = user?.role || 'customer'
  const isStaff = role === 'staff' || role === 'admin'
  const firstName = (user?.name || 'there').split(' ')[0]

  const nav = [
    { key: 'overview', label: 'Overview', icon: <GridIcon /> },
    { key: 'accounts', label: 'Accounts', icon: <WalletIcon /> },
    { key: 'transactions', label: 'Transactions', icon: <ListIcon /> },
    { key: 'transfers', label: 'Transfers', icon: <SwapIcon /> },
    ...(isStaff
      ? [
          { key: 'customers', label: 'Customers', icon: <UsersIcon /> },
          { key: 'reports', label: 'Reports', icon: <ChartIcon /> },
        ]
      : []),
    { key: 'settings', label: 'Settings', icon: <CogIcon /> },
  ]

  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(() => setNotice(''), 2600)
    return () => clearTimeout(t)
  }, [notice])

  const comingSoon = (label) => setNotice(`${label} is coming in the next module.`)

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/login')
    }
  }

  const total = accounts.reduce((s, a) => s + a.balance, 0)
  const moneyIn = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const moneyOut = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const pending = transactions.filter((t) => t.status === 'Pending').length
  const chartMax = Math.max(...cashflow.flatMap((c) => [c.in, c.out]))

  const stats = [
    { num: fmt(total), cap: 'Total balance', badge: '3.4%' },
    { num: fmt(moneyIn), cap: 'Money in · this month' },
    { num: fmt(moneyOut), cap: 'Money out · this month' },
    { num: String(pending), cap: 'Pending payments' },
  ]

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const security = [
    { label: 'Email address', ok: !!user?.isEmailVerified, yes: 'Verified', no: 'Not verified' },
    { label: 'Account status', ok: user?.isActive !== false, yes: 'Active', no: 'Inactive' },
    { label: 'Encrypted session', ok: true, yes: 'On', no: 'Off' },
  ]

  return (
    <div className="db">
      {/* ---------- Sidebar ---------- */}
      <aside className="db-side">
        <Link to="/" className="db-logo" aria-label="Northbank home">
          <span className="db-logo__name">northbank</span>
          <span className="db-logo__sub">Banking workspace</span>
        </Link>

        <nav className="db-nav" aria-label="Main">
          {nav.map((n) => (
            <button
              key={n.key}
              type="button"
              className={`db-nav__item${n.key === 'overview' ? ' is-active' : ''}`}
              aria-current={n.key === 'overview' ? 'page' : undefined}
              onClick={() => n.key !== 'overview' && comingSoon(n.label)}
            >
              {n.icon}
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="db-user">
          <span className="db-avatar">{initials(user?.name)}</span>
          <div className="db-user__info">
            <div className="db-user__name">{user?.name || 'Northbank user'}</div>
            <div className="db-user__role">{role}</div>
          </div>
          <button type="button" className="db-user__out" onClick={handleLogout} aria-label="Sign out" title="Sign out">
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div className="db-main">
        {/* Mobile top bar */}
        <div className="db-mobilebar">
          <Link to="/" className="db-mobilebar__logo">
            northbank
          </Link>
          <button type="button" className="db-btn db-btn--outline" onClick={handleLogout}>
            Sign out
          </button>
        </div>
        <div className="db-mobilenav" role="tablist" aria-label="Sections">
          {nav.map((n) => (
            <button
              key={n.key}
              type="button"
              className={`db-chiptab${n.key === 'overview' ? ' is-active' : ''}`}
              onClick={() => n.key !== 'overview' && comingSoon(n.label)}
            >
              {n.label}
            </button>
          ))}
        </div>

        <div className="db-content">
          {/* Header */}
          <header className="db-head">
            <div>
              <div className="db-eyebrow">{today}</div>
              <h1 className="db-title">
                {greeting()}, {firstName}
              </h1>
              <p className="db-sub">Here’s a clear view of your accounts and recent activity.</p>
            </div>
            <div className="db-head__actions">
              <button type="button" className="db-btn db-btn--outline" onClick={() => comingSoon('Statements')}>
                Download statement
              </button>
              <button type="button" className="db-btn db-btn--primary" onClick={() => comingSoon('Transfers')}>
                New transfer
                <ArrowRightIcon />
              </button>
            </div>
          </header>

          {/* Stats strip */}
          <section className="db-stats" aria-label="Account summary">
            {stats.map((s) => (
              <div className="db-stat" key={s.cap}>
                <div className="db-stat__num">
                  {s.num}
                  {s.badge && (
                    <span className="db-badge">
                      <TrendUpIcon /> {s.badge}
                    </span>
                  )}
                </div>
                <div className="db-stat__cap">{s.cap}</div>
              </div>
            ))}
          </section>

          {/* Quick actions */}
          <section className="db-actions" aria-label="Quick actions">
            {quickActions.map((a) => (
              <button key={a.label} type="button" className="db-action" onClick={() => comingSoon(a.note)}>
                <span className="db-icon">{a.icon}</span>
                <span className="db-action__text">
                  <span className="db-action__label">{a.label}</span>
                  <span className="db-action__hint">{a.hint}</span>
                </span>
              </button>
            ))}
          </section>

          {/* Cashflow + accounts */}
          <div className="db-row db-row--wide-left">
            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Cash flow</h2>
                  <p className="db-card__sub">Money in vs. money out, last 6 months</p>
                </div>
                <div className="db-legend">
                  <span>
                    <i className="db-dot db-dot--in" /> In
                  </span>
                  <span>
                    <i className="db-dot db-dot--out" /> Out
                  </span>
                </div>
              </div>

              <div className="db-chart" role="img" aria-label="Bar chart of monthly money in and money out, in thousands of dollars">
                {cashflow.map((c) => (
                  <div className="db-chart__col" key={c.m}>
                    <div className="db-chart__bars">
                      <span className="db-bar db-bar--in" style={{ height: `${(c.in / chartMax) * 100}%` }} title={`In: $${c.in}k`} />
                      <span className="db-bar db-bar--out" style={{ height: `${(c.out / chartMax) * 100}%` }} title={`Out: $${c.out}k`} />
                    </div>
                    <span className="db-chart__label">{c.m}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="db-navy">
              <div className="db-navy__label">Total across accounts</div>
              <div className="db-navy__row">
                <div className="db-navy__value">{fmt(total)}</div>
                <span className="db-navy__badge">
                  <TrendUpIcon /> 3.4% this month
                </span>
              </div>
              <Sparkline values={trend} />

              <div className="db-navy__list">
                {accounts.map((a) => (
                  <div className="db-navy__acct" key={a.num}>
                    <div>
                      <div className="db-navy__acct-name">{a.name}</div>
                      <div className="db-navy__acct-num">•••• {a.num}</div>
                    </div>
                    <div className="db-navy__acct-bal">{fmt(a.balance)}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Transactions + profile */}
          <div className="db-row db-row--wide-left">
            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Recent transactions</h2>
                  <p className="db-card__sub">Your latest activity across all accounts</p>
                </div>
                <button type="button" className="db-link" onClick={() => comingSoon('Transactions')}>
                  View all
                </button>
              </div>

              <ul className="db-tx">
                {transactions.map((t) => {
                  const credit = t.amount > 0
                  return (
                    <li className="db-tx__row" key={t.id}>
                      <span className={`db-tx__icon ${credit ? 'is-in' : 'is-out'}`}>
                        {credit ? <ArrowDownIcon /> : <ArrowUpIcon />}
                      </span>
                      <div className="db-tx__main">
                        <div className="db-tx__title">{t.title}</div>
                        <div className="db-tx__sub">
                          {t.sub} · {t.date}
                        </div>
                      </div>
                      <span className={`db-status ${t.status === 'Pending' ? 'is-pending' : 'is-done'}`}>{t.status}</span>
                      <div className={`db-tx__amt ${credit ? 'is-in' : ''}`}>
                        {credit ? '+' : '−'}
                        {fmt(Math.abs(t.amount))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Your profile</h2>
                  <p className="db-card__sub">Signed in to your workspace</p>
                </div>
                <span className="db-chip">{role}</span>
              </div>

              <div className="db-profile">
                <span className="db-avatar db-avatar--lg">{initials(user?.name)}</span>
                <div className="db-profile__info">
                  <div className="db-profile__name">{user?.name}</div>
                  <div className="db-profile__email">{user?.email}</div>
                </div>
              </div>

              <dl className="db-dl">
                <div>
                  <dt>Last sign-in</dt>
                  <dd>{user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Just now'}</dd>
                </div>
                <div>
                  <dt>Member since</dt>
                  <dd>
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                      : '—'}
                  </dd>
                </div>
              </dl>

              <ul className="db-checks">
                {security.map((s) => (
                  <li key={s.label}>
                    <span className={`db-checks__tick${s.ok ? '' : ' is-off'}`}>{s.ok && <CheckIcon />}</span>
                    <span className="db-checks__label">{s.label}</span>
                    <span className={`db-checks__state${s.ok ? '' : ' is-off'}`}>{s.ok ? s.yes : s.no}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <footer className="db-foot">
            <span>© 2026 Northbank</span>
            <span>Figures shown are sample data until the banking module is connected.</span>
          </footer>
        </div>
      </div>

      {notice && (
        <div className="db-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  )
}
