import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import { ArrowRightIcon } from '../components/appIcons'
import {
  depositToAccount,
  listAccounts,
  newIdempotencyKey,
  openAccount,
} from '../services/api'
import { formatMinor, toMinorUnits } from '../utils/money'
import { ACCOUNT_TYPE_LABELS, maskAccount } from '../utils/format'

const ACCOUNT_TYPES = ['savings', 'current', 'fixed_deposit']

const nextAccountId = (list, currentId) => {
  if (currentId && list.some((account) => account._id === currentId)) return currentId
  const firstActive = list.find((account) => account.status === 'active')
  return firstActive?._id || list[0]?._id || ''
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')

  const [type, setType] = useState('savings')
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState('')

  const [depositForm, setDepositForm] = useState({ accountId: '', amount: '', description: '' })
  const [depositing, setDepositing] = useState(false)
  const [depositError, setDepositError] = useState('')
  const depositKey = useRef(newIdempotencyKey())

  const fetchAccounts = async (showSpinner = false) => {
    if (showSpinner) {
      setLoading(true)
      setLoadError('')
    }
    try {
      const data = await listAccounts()
      setAccounts(data.accounts)
      setLoadError('')
      setDepositForm((current) => ({
        ...current,
        accountId: nextAccountId(data.accounts, current.accountId),
      }))
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load your accounts.')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    listAccounts()
      .then((data) => {
        if (!active) return
        setAccounts(data.accounts)
        setLoadError('')
        setDepositForm((current) => ({
          ...current,
          accountId: nextAccountId(data.accounts, current.accountId),
        }))
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
  }, [])

  const handleOpen = async (event) => {
    event.preventDefault()
    setOpenError('')
    setNotice('')
    setOpening(true)
    try {
      const data = await openAccount(type)
      setNotice(
        `Opened a ${ACCOUNT_TYPE_LABELS[data.account.type]} account ${maskAccount(
          data.account.accountNumber
        )}.`
      )
      await fetchAccounts(false)
    } catch (err) {
      setOpenError(err.response?.data?.message || 'Could not open the account.')
    } finally {
      setOpening(false)
    }
  }

  const handleDeposit = async (event) => {
    event.preventDefault()
    setDepositError('')
    setNotice('')

    if (!depositForm.accountId) {
      setDepositError('Choose an account to deposit into.')
      return
    }
    const amountMinor = toMinorUnits(depositForm.amount)
    if (!amountMinor) {
      setDepositError('Enter an amount greater than zero, with at most 2 decimals.')
      return
    }

    setDepositing(true)
    try {
      const data = await depositToAccount(depositForm.accountId, {
        amountMinor,
        description: depositForm.description.trim(),
        idempotencyKey: depositKey.current,
      })
      depositKey.current = newIdempotencyKey()
      setDepositForm((current) => ({ ...current, amount: '', description: '' }))
      setNotice(
        data.replayed
          ? 'That deposit was already processed — it was not applied twice.'
          : `Deposited ${formatMinor(amountMinor)} successfully.`
      )
      await fetchAccounts(false)
    } catch (err) {
      setDepositError(err.response?.data?.message || 'Deposit failed. Please try again.')
      // A real response means the request was decided; next attempt is a new one.
      if (err.response) depositKey.current = newIdempotencyKey()
    } finally {
      setDepositing(false)
    }
  }

  const activeAccounts = accounts.filter((account) => account.status === 'active')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Your money"
        title="Accounts"
        sub="Open an account, review balances and add funds."
        actions={
          <Link to="/transfers" className="db-btn db-btn--primary">
            New transfer
            <ArrowRightIcon />
          </Link>
        }
      />

      {notice && (
        <div className="db-alert db-alert--success" role="status">
          {notice}
        </div>
      )}

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
              onClick={() => fetchAccounts(true)}
            >
              Try again
            </button>
          </div>
        </>
      )}

      {!loading && !loadError && (
        <>
          <section className="db-card" style={{ marginTop: 20 }}>
            <div className="db-card__head">
              <div>
                <h2 className="db-card__title">Your accounts</h2>
                <p className="db-card__sub">
                  {accounts.length === 0
                    ? 'No accounts yet — open your first one below.'
                    : `${accounts.length} of 5 open accounts`}
                </p>
              </div>
            </div>

            {accounts.length === 0 ? (
              <div className="db-empty">
                <div className="db-empty__title">Nothing here yet</div>
                <p className="db-empty__text">
                  Savings, current and fixed deposit accounts all live here once you open them.
                </p>
              </div>
            ) : (
              <div className="acct-grid">
                {accounts.map((account) => (
                  <article className="acct-card" key={account._id}>
                    <div className="acct-card__type">
                      {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                    </div>
                    <div className="acct-card__num">{maskAccount(account.accountNumber)}</div>
                    <div className="acct-card__balance">{formatMinor(account.balance)}</div>
                    <div className="acct-card__foot">
                      <span className={`pill pill--${account.status}`}>{account.status}</span>
                      <span>{account.currency}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="db-page-grid">
            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Open an account</h2>
                  <p className="db-card__sub">Pick a type and we’ll generate the account number.</p>
                </div>
              </div>

              <form className="db-form" onSubmit={handleOpen}>
                <div className="field">
                  <label htmlFor="account-type">Account type</label>
                  <select
                    id="account-type"
                    className="input db-select"
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                  >
                    {ACCOUNT_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {ACCOUNT_TYPE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>

                {openError && (
                  <div className="db-alert db-alert--error" role="alert">
                    {openError}
                  </div>
                )}

                <div className="db-form__actions">
                  <button type="submit" className="db-btn db-btn--primary" disabled={opening}>
                    {opening ? 'Opening…' : 'Open account'}
                  </button>
                  <span className="db-form__hint">You can hold up to 5 open accounts.</span>
                </div>
              </form>
            </section>

            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Add funds</h2>
                  <p className="db-card__sub">Top up one of your active accounts.</p>
                </div>
              </div>

              {activeAccounts.length === 0 ? (
                <div className="db-empty">
                  <div className="db-empty__title">No active accounts</div>
                  <p className="db-empty__text">
                    Open an account first, then you can deposit into it.
                  </p>
                </div>
              ) : (
                <form className="db-form" onSubmit={handleDeposit}>
                  <div className="field">
                    <label htmlFor="deposit-account">Deposit into</label>
                    <select
                      id="deposit-account"
                      className="input db-select"
                      value={depositForm.accountId}
                      onChange={(event) =>
                        setDepositForm((current) => ({
                          ...current,
                          accountId: event.target.value,
                        }))
                      }
                    >
                      {activeAccounts.map((account) => (
                        <option key={account._id} value={account._id}>
                          {ACCOUNT_TYPE_LABELS[account.type]} {maskAccount(account.accountNumber)} ·{' '}
                          {formatMinor(account.balance)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="deposit-amount">Amount (₹)</label>
                    <input
                      id="deposit-amount"
                      className="input"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={depositForm.amount}
                      onChange={(event) =>
                        setDepositForm((current) => ({ ...current, amount: event.target.value }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="deposit-description">Description (optional)</label>
                    <input
                      id="deposit-description"
                      className="input"
                      type="text"
                      maxLength={140}
                      placeholder="Salary, savings top-up…"
                      value={depositForm.description}
                      onChange={(event) =>
                        setDepositForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>

                  {depositError && (
                    <div className="db-alert db-alert--error" role="alert">
                      {depositError}
                    </div>
                  )}

                  <div className="db-form__actions">
                    <button type="submit" className="db-btn db-btn--primary" disabled={depositing}>
                      {depositing ? 'Depositing…' : 'Deposit'}
                    </button>
                    <span className="db-form__hint">Repeat clicks are protected against double charges.</span>
                  </div>
                </form>
              )}
            </section>
          </div>
        </>
      )}
    </AppShell>
  )
}
