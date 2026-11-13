import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authStore'
import AppShell, { PageHeader } from '../components/AppShell'
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CogIcon,
  ListIcon,
  PlusIcon,
  SwapIcon,
  TrendUpIcon,
  CheckIcon,
} from '../components/appIcons'
import { getDashboardSummary } from '../services/api'
import { formatMinor } from '../utils/money'
import {
  ACCOUNT_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
  formatDate,
  last4,
  maskAccount,
  monthLabel,
} from '../utils/format'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function initials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'NB'
  )
}

function Sparkline({ values }) {
  const width = 320
  const height = 64
  const safeValues = values.length === 1 ? [values[0], values[0]] : values
  const min = Math.min(...safeValues)
  const max = Math.max(...safeValues)
  const span = max - min
  const points = safeValues.map((value, index) => {
    const x = (index / (safeValues.length - 1)) * width
    const y = span === 0 ? height / 2 : height - 6 - ((value - min) / span) * (height - 14)
    return [x, y]
  })
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `0,${height} ${line} ${width},${height}`

  return (
    <svg className="db-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="dbSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a9b4ff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#a9b4ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#dbSparkFill)" />
      <polyline
        points={line}
        fill="none"
        stroke="#c7ceff"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

const QUICK_ACTIONS = [
  { to: '/transfers', label: 'Transfer', hint: 'Move money', icon: <SwapIcon /> },
  { to: '/accounts', label: 'Deposit', hint: 'Add funds', icon: <PlusIcon /> },
  { to: '/transactions', label: 'Transactions', hint: 'Full ledger', icon: <ListIcon /> },
  { to: '/settings', label: 'Settings', hint: 'Profile & password', icon: <CogIcon /> },
]

export default function Dashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    getDashboardSummary()
      .then((data) => {
        if (active) setSummary(data)
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || 'Could not load your overview.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  const accounts = summary?.accounts ?? []
  const recent = summary?.recentTransactions ?? []
  const cashflow = summary?.cashflow ?? []
  const balanceTrend = summary?.balanceTrend ?? []
  const totals = summary?.totals ?? {
    balanceMinor: 0,
    moneyInMinor: 0,
    moneyOutMinor: 0,
    pendingCount: 0,
  }

  const accountsById = new Map(accounts.map((account) => [account._id, account]))
  const chartMax = Math.max(
    1,
    ...cashflow.flatMap((month) => [month.inMinor, month.outMinor])
  )

  const role = user?.role || 'customer'
  const firstName = (user?.name || 'there').split(' ')[0]
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const stats = [
    { value: formatMinor(totals.balanceMinor), cap: 'Total balance' },
    { value: formatMinor(totals.moneyInMinor), cap: 'Money in · this month' },
    { value: formatMinor(totals.moneyOutMinor), cap: 'Money out · this month' },
    { value: String(totals.pendingCount), cap: 'Pending payments' },
  ]

  const security = [
    { label: 'Email address', ok: !!user?.isEmailVerified, yes: 'Verified', no: 'Not verified' },
    { label: 'Account status', ok: user?.isActive !== false, yes: 'Active', no: 'Inactive' },
    { label: 'Encrypted session', ok: true, yes: 'On', no: 'Off' },
  ]

  return (
    <AppShell>
      <PageHeader
        eyebrow={today}
        title={`${greeting()}, ${firstName}`}
        sub="Here’s a clear view of your accounts and recent activity."
        actions={
          <>
            <Link to="/transactions" className="db-btn db-btn--outline">
              View transactions
            </Link>
            <Link to="/transfers" className="db-btn db-btn--primary">
              New transfer
              <ArrowRightIcon />
            </Link>
          </>
        }
      />

      {loading && <div className="db-loading">Loading your overview…</div>}

      {!loading && error && (
        <>
          <div className="db-alert db-alert--error" role="alert">
            {error}
          </div>
          <div className="db-form__actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="db-btn db-btn--outline"
              onClick={() => {
                setLoading(true)
                setError('')
                setReloadKey((key) => key + 1)
              }}
            >
              Try again
            </button>
          </div>
        </>
      )}

      {!loading && !error && (
        <>
          <section className="db-stats" aria-label="Account summary">
            {stats.map((stat) => (
              <div className="db-stat" key={stat.cap}>
                <div className="db-stat__num">{stat.value}</div>
                <div className="db-stat__cap">{stat.cap}</div>
              </div>
            ))}
          </section>

          <section className="db-actions" aria-label="Quick actions">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.label} to={action.to} className="db-action">
                <span className="db-icon">{action.icon}</span>
                <span className="db-action__text">
                  <span className="db-action__label">{action.label}</span>
                  <span className="db-action__hint">{action.hint}</span>
                </span>
              </Link>
            ))}
          </section>

          {accounts.length === 0 ? (
            <section className="db-card" style={{ marginTop: 20 }}>
              <div className="db-empty" style={{ marginTop: 0 }}>
                <div className="db-empty__title">No accounts yet</div>
                <p className="db-empty__text">
                  Open your first savings, current or fixed deposit account to start banking.
                </p>
                <Link to="/accounts" className="db-btn db-btn--primary">
                  Open an account
                </Link>
              </div>
            </section>
          ) : (
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

                <div className="db-chart" role="img" aria-label="Monthly money in and money out">
                  {cashflow.map((month) => (
                    <div className="db-chart__col" key={month.month}>
                      <div className="db-chart__bars">
                        <span
                          className="db-bar db-bar--in"
                          style={{ height: `${(month.inMinor / chartMax) * 100}%` }}
                          title={`In: ${formatMinor(month.inMinor)}`}
                        />
                        <span
                          className="db-bar db-bar--out"
                          style={{ height: `${(month.outMinor / chartMax) * 100}%` }}
                          title={`Out: ${formatMinor(month.outMinor)}`}
                        />
                      </div>
                      <span className="db-chart__label">{monthLabel(month.month)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="db-navy">
                <div className="db-navy__label">Total across accounts</div>
                <div className="db-navy__row">
                  <div className="db-navy__value">{formatMinor(totals.balanceMinor)}</div>
                  <span className="db-navy__badge">
                    <TrendUpIcon /> {accounts.length} open {accounts.length === 1 ? 'account' : 'accounts'}
                  </span>
                </div>
                {balanceTrend.length > 0 && (
                  <Sparkline values={balanceTrend.map((day) => day.balanceMinor)} />
                )}

                <div className="db-navy__list">
                  {accounts.map((account) => (
                    <div className="db-navy__acct" key={account._id}>
                      <div>
                        <div className="db-navy__acct-name">
                          {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                        </div>
                        <div className="db-navy__acct-num">{maskAccount(account.accountNumber)}</div>
                      </div>
                      <div className="db-navy__acct-bal">{formatMinor(account.balance)}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          <div className="db-row db-row--wide-left">
            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Recent transactions</h2>
                  <p className="db-card__sub">Your latest activity across all accounts</p>
                </div>
                <Link to="/transactions" className="db-link">
                  View all
                </Link>
              </div>

              {recent.length === 0 ? (
                <div className="db-empty">
                  <div className="db-empty__title">No activity yet</div>
                  <p className="db-empty__text">
                    Deposits and transfers will show up here as soon as they happen.
                  </p>
                </div>
              ) : (
                <ul className="db-tx">
                  {recent.map((transaction) => {
                    const credit = transaction.amount > 0
                    const account = accountsById.get(transaction.account)
                    const sub = [
                      transaction.counterpartyAccountNumber
                        ? `A/C •••• ${last4(transaction.counterpartyAccountNumber)}`
                        : account
                          ? ACCOUNT_TYPE_LABELS[account.type]
                          : null,
                      formatDate(transaction.createdAt),
                    ]
                      .filter(Boolean)
                      .join(' · ')

                    return (
                      <li className="db-tx__row" key={transaction._id}>
                        <span className={`db-tx__icon ${credit ? 'is-in' : 'is-out'}`}>
                          {credit ? <ArrowDownIcon /> : <ArrowUpIcon />}
                        </span>
                        <div className="db-tx__main">
                          <div className="db-tx__title">
                            {transaction.description ||
                              TRANSACTION_TYPE_LABELS[transaction.type] ||
                              'Transaction'}
                          </div>
                          <div className="db-tx__sub">{sub}</div>
                        </div>
                        <span
                          className={`db-status ${
                            transaction.status === 'pending'
                              ? 'is-pending'
                              : transaction.status === 'failed'
                                ? 'is-failed'
                                : 'is-done'
                          }`}
                        >
                          {transaction.status}
                        </span>
                        <div className={`db-tx__amt ${credit ? 'is-in' : ''}`}>
                          {credit ? '+' : '−'}
                          {formatMinor(Math.abs(transaction.amount))}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
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
                  <dd>
                    {user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Just now'}
                  </dd>
                </div>
                <div>
                  <dt>Member since</dt>
                  <dd>
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </dd>
                </div>
              </dl>

              <ul className="db-checks">
                {security.map((item) => (
                  <li key={item.label}>
                    <span className={`db-checks__tick${item.ok ? '' : ' is-off'}`}>
                      {item.ok && <CheckIcon />}
                    </span>
                    <span className="db-checks__label">{item.label}</span>
                    <span className={`db-checks__state${item.ok ? '' : ' is-off'}`}>
                      {item.ok ? item.yes : item.no}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="db-note">
                <Link to="/settings" className="db-link">
                  Manage your profile and password →
                </Link>
              </p>
            </section>
          </div>

          <footer className="db-foot">
            <span>© 2026 Northbank</span>
            <span>Figures update live from the banking ledger.</span>
          </footer>
        </>
      )}
    </AppShell>
  )
}
