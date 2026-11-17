import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import { DepositIcon } from '../components/appIcons'
import {
  depositToAccount,
  getLimits,
  listAccounts,
  newIdempotencyKey,
  withdrawFromAccount,
} from '../services/api'
import { formatMinor, formatRupees, toMinorUnits } from '../utils/money'
import { ACCOUNT_TYPE_LABELS } from '../utils/format'

const DEPOSIT_SOURCES = [
  'Direct Deposit (Salary / Income)',
  'Cash Deposit',
  'Cheque Deposit',
  'Transfer from Another Bank',
  'Other',
]
const WITHDRAWAL_MODES = ['Cash Withdrawal', 'Wire Withdrawal', 'Bill / Other Payment']
const DESCRIPTION_MAX = 140

const buildDescription = (label, note) => {
  const text = note.trim() ? `${label} · ${note.trim()}` : label
  return text.slice(0, DESCRIPTION_MAX)
}

export default function Deposits() {
  const [tab, setTab] = useState('deposit')
  const [accounts, setAccounts] = useState([])
  const [limits, setLimits] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState('')

  const [accountId, setAccountId] = useState('')
  const [form, setForm] = useState({
    amount: '',
    source: DEPOSIT_SOURCES[0],
    mode: WITHDRAWAL_MODES[0],
    note: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const depositKey = useRef(newIdempotencyKey())
  const withdrawKey = useRef(newIdempotencyKey())

  useEffect(() => {
    let active = true
    Promise.all([listAccounts(), getLimits().catch(() => null)])
      .then(([accountData, limitData]) => {
        if (!active) return
        setAccounts(accountData.accounts)
        setLimits(limitData?.limits || null)
        setLoadError('')
        const usable = accountData.accounts.filter((account) => account.status === 'active')
        setAccountId((current) =>
          usable.some((account) => account._id === current) ? current : usable[0]?._id || ''
        )
      })
      .catch((err) => {
        if (active) setLoadError(err.response?.data?.message || 'Could not load your accounts.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const activeAccounts = accounts.filter((account) => account.status === 'active')
  const account = activeAccounts.find((item) => item._id === accountId) || null
  const isDeposit = tab === 'deposit'

  const withdrawalRemaining = limits ? Math.max(0, limits.withdrawal.limit - limits.withdrawal.used) : null
  const usedPercent = limits
    ? Math.min(100, Math.round((limits.withdrawal.used / limits.withdrawal.limit) * 100))
    : 0

  const switchTab = (next) => {
    setTab(next)
    setError('')
    setNotice('')
    setForm((current) => ({ ...current, amount: '', note: '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!accountId) {
      setError(isDeposit ? 'Choose an account to credit.' : 'Choose an account to debit.')
      return
    }
    const amountMinor = toMinorUnits(form.amount)
    if (!amountMinor) {
      setError('Enter an amount greater than zero, with at most 2 decimals.')
      return
    }
    if (isDeposit && limits && amountMinor > limits.depositMax) {
      setError(`The maximum deposit per transaction is ${formatRupees(limits.depositMax)}.`)
      return
    }
    if (!isDeposit) {
      if (account && amountMinor > account.balance) {
        setError(`Insufficient funds. Available balance: ${formatMinor(account.balance)}.`)
        return
      }
      if (withdrawalRemaining !== null && amountMinor > withdrawalRemaining) {
        setError(
          `This exceeds your daily withdrawal limit. You can still withdraw ${formatMinor(withdrawalRemaining)} today.`
        )
        return
      }
    }

    setBusy(true)
    try {
      if (isDeposit) {
        const data = await depositToAccount(accountId, {
          amountMinor,
          description: buildDescription(form.source, form.note),
          idempotencyKey: depositKey.current,
        })
        depositKey.current = newIdempotencyKey()
        setNotice(
          data.replayed
            ? 'This deposit was already processed — no money was added twice.'
            : `Deposited ${formatMinor(amountMinor)} successfully.`
        )
      } else {
        const data = await withdrawFromAccount(accountId, {
          amountMinor,
          description: buildDescription(form.mode, form.note),
          idempotencyKey: withdrawKey.current,
        })
        withdrawKey.current = newIdempotencyKey()
        setNotice(
          data.replayed
            ? 'This withdrawal was already processed — no money moved twice.'
            : `Withdrew ${formatMinor(amountMinor)} successfully.`
        )
      }
      setForm((current) => ({ ...current, amount: '', note: '' }))
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(err.response?.data?.message || 'The request failed. Please try again.')
      if (err.response) {
        if (isDeposit) depositKey.current = newIdempotencyKey()
        else withdrawKey.current = newIdempotencyKey()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Personal banking"
        title="Deposits & Withdrawals"
        sub="Manage your funds securely with real-time balance updates and transaction checks."
        actions={
          <Link to="/transactions" className="db-btn db-btn--outline">
            View ledger
          </Link>
        }
      />

      {loading && <div className="db-loading">Loading your accounts…</div>}

      {!loading && loadError && (
        <>
          <div className="db-alert db-alert--error" role="alert">
            {loadError}
          </div>
          <div className="db-form__actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="db-btn db-btn--outline"
              onClick={() => {
                setLoading(true)
                setReloadKey((key) => key + 1)
              }}
            >
              Try again
            </button>
          </div>
        </>
      )}

      {!loading && !loadError && activeAccounts.length === 0 && (
        <div className="db-empty">
          <div className="db-empty__title">No active accounts</div>
          <p className="db-empty__text">You need an active account before you can deposit or withdraw.</p>
          <Link to="/accounts" className="db-btn db-btn--primary">
            Go to my accounts
          </Link>
        </div>
      )}

      {!loading && !loadError && activeAccounts.length > 0 && (
        <>
          <div className="seg-tabs" role="tablist" aria-label="Deposit or withdraw">
            <button
              type="button"
              role="tab"
              aria-selected={isDeposit}
              className={isDeposit ? 'is-active' : ''}
              onClick={() => switchTab('deposit')}
            >
              <DepositIcon /> Instant Deposit Funds
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isDeposit}
              className={!isDeposit ? 'is-active' : ''}
              onClick={() => switchTab('withdraw')}
            >
              Cash / Wire Withdrawal
            </button>
          </div>

          {notice && (
            <div className="db-alert db-alert--success" role="status">
              {notice}
            </div>
          )}

          <div className="db-page-grid">
            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">{isDeposit ? 'Add Money to Account' : 'Withdraw from Account'}</h2>
                  <p className="db-card__sub">
                    {isDeposit
                      ? `Maximum simulated deposit per transaction: ${limits ? formatRupees(limits.depositMax) : '₹10,00,000'}.`
                      : 'Withdrawals are checked against your balance and daily limit. Overdrafts are not allowed.'}
                  </p>
                </div>
              </div>

              <form className="db-form" onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="dw-account">{isDeposit ? 'Credit to Bank Account' : 'Debit from Bank Account'}</label>
                  <select
                    id="dw-account"
                    className="input db-select"
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                  >
                    {activeAccounts.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.accountNumber} ({ACCOUNT_TYPE_LABELS[item.type]} — Balance: {formatMinor(item.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="dw-amount">Amount (₹)</label>
                  <input
                    id="dw-amount"
                    className="input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  />
                  {isDeposit && limits && (
                    <div className="field-hint">
                      Maximum simulated deposit per transaction: {formatRupees(limits.depositMax)}
                    </div>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="dw-category">{isDeposit ? 'Deposit Source / Category' : 'Withdrawal Type'}</label>
                  <select
                    id="dw-category"
                    className="input db-select"
                    value={isDeposit ? form.source : form.mode}
                    onChange={(event) =>
                      setForm((current) =>
                        isDeposit
                          ? { ...current, source: event.target.value }
                          : { ...current, mode: event.target.value }
                      )
                    }
                  >
                    {(isDeposit ? DEPOSIT_SOURCES : WITHDRAWAL_MODES).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="dw-note">Transaction Notes (Optional)</label>
                  <input
                    id="dw-note"
                    className="input"
                    type="text"
                    maxLength={80}
                    placeholder={isDeposit ? 'e.g. Salary, ATM cash deposit, Monthly top-up' : 'e.g. Rent, cash needs'}
                    value={form.note}
                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  />
                </div>

                {error && (
                  <div className="db-alert db-alert--error" role="alert">
                    {error}
                  </div>
                )}

                <div className="db-form__actions">
                  <button type="submit" className="db-btn db-btn--primary" disabled={busy}>
                    {busy ? 'Processing…' : isDeposit ? 'Deposit funds' : 'Withdraw funds'}
                  </button>
                  <span className="db-form__hint">Double submissions are blocked automatically.</span>
                </div>
              </form>
            </section>

            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Account Overview</h2>
                  <p className="db-card__sub">Selected account</p>
                </div>
              </div>

              <div className="db-kv" style={{ gridTemplateColumns: '1fr', marginTop: 16 }}>
                <div>
                  <dt>Account number</dt>
                  <dd style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: '0.06em' }}>
                    {account?.accountNumber || '—'}
                  </dd>
                </div>
              </div>

              <div className="overview-row" style={{ marginTop: 18 }}>
                <span>Available balance</span>
              </div>
              <div className="overview-balance">{account ? formatMinor(account.balance) : '—'}</div>

              <div className="overview-row">
                <span>Daily withdrawal limit</span>
                <strong>{limits ? formatMinor(limits.withdrawal.limit) : '—'}</strong>
              </div>
              {limits && (
                <>
                  <div className="limit-meter" aria-hidden="true">
                    <div className={`limit-meter__bar${usedPercent >= 80 ? ' is-high' : ''}`} style={{ width: `${usedPercent}%` }} />
                  </div>
                  <div className="overview-row">
                    <span>Used today: {formatMinor(limits.withdrawal.used)}</span>
                    <span>Left: {formatMinor(withdrawalRemaining)}</span>
                  </div>
                  <div className="field-hint" style={{ marginTop: 8 }}>
                    Resets daily at 00:00 midnight IST.
                  </div>
                </>
              )}

              <div className="secure-box">
                <strong>Secure transactions</strong>
                <span>
                  Every request is signed to your authenticated Northbank session, checked for duplicates and
                  recorded in your ledger the moment it posts.
                </span>
              </div>
            </section>
          </div>
        </>
      )}
    </AppShell>
  )
}
