import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import { ArrowRightIcon } from '../components/appIcons'
import { createTransfer, listAccounts, newIdempotencyKey } from '../services/api'
import { formatMinor, toMinorUnits } from '../utils/money'
import { ACCOUNT_TYPE_LABELS, maskAccount } from '../utils/format'

const EMPTY_FORM = { fromAccountId: '', toAccountNumber: '', amount: '', description: '' }

const nextFromAccountId = (list, currentId) => {
  const stillActive =
    currentId &&
    list.some((account) => account._id === currentId && account.status === 'active')
  if (stillActive) return currentId
  const firstActive = list.find((account) => account.status === 'active')
  return firstActive?._id || ''
}

export default function Transfers() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const idempotencyKey = useRef(newIdempotencyKey())

  const fetchAccounts = async (showSpinner = false) => {
    if (showSpinner) {
      setLoading(true)
      setLoadError('')
    }
    try {
      const data = await listAccounts()
      setAccounts(data.accounts)
      setLoadError('')
      setForm((current) => ({
        ...current,
        fromAccountId: nextFromAccountId(data.accounts, current.fromAccountId),
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
        setForm((current) => ({
          ...current,
          fromAccountId: nextFromAccountId(data.accounts, current.fromAccountId),
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

  const activeAccounts = accounts.filter((account) => account.status === 'active')
  const fromAccount = accounts.find((account) => account._id === form.fromAccountId)

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')
    setResult(null)

    if (!form.fromAccountId) {
      setFormError('Choose the account to transfer from.')
      return
    }
    if (!/^\d{12}$/.test(form.toAccountNumber.trim())) {
      setFormError('Enter a valid 12-digit destination account number.')
      return
    }
    if (fromAccount && fromAccount.accountNumber === form.toAccountNumber.trim()) {
      setFormError('Source and destination accounts must be different.')
      return
    }
    const amountMinor = toMinorUnits(form.amount)
    if (!amountMinor) {
      setFormError('Enter an amount greater than zero, with at most 2 decimals.')
      return
    }

    setSubmitting(true)
    try {
      const data = await createTransfer({
        fromAccountId: form.fromAccountId,
        toAccountNumber: form.toAccountNumber.trim(),
        amountMinor,
        description: form.description.trim(),
        idempotencyKey: idempotencyKey.current,
      })
      idempotencyKey.current = newIdempotencyKey()
      setResult({
        ...data,
        amountMinor,
        toAccountNumber: form.toAccountNumber.trim(),
      })
      setForm((current) => ({
        ...current,
        toAccountNumber: '',
        amount: '',
        description: '',
      }))
      await fetchAccounts(false)
    } catch (err) {
      setFormError(err.response?.data?.message || 'Transfer failed. Please try again.')
      // A real response means the request was decided; the next attempt is new.
      if (err.response) idempotencyKey.current = newIdempotencyKey()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Move money"
        title="Transfers"
        sub="Send money to any account number at Northbank."
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
            <button type="button" className="db-btn db-btn--outline" onClick={() => fetchAccounts(true)}>
              Try again
            </button>
          </div>
        </>
      )}

      {!loading && !loadError && (
        <>
          {result && (
            <div className="db-alert db-alert--success" role="status">
              {result.replayed
                ? 'This transfer was already processed — no money was moved twice.'
                : `Sent ${formatMinor(result.amountMinor)} to ${maskAccount(result.toAccountNumber)}.`}{' '}
              Reference: <strong>{result.transferId}</strong>
            </div>
          )}

          <div className="db-page-grid">
            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">New transfer</h2>
                  <p className="db-card__sub">Transfers post instantly and appear in your ledger.</p>
                </div>
              </div>

              {activeAccounts.length === 0 ? (
                <div className="db-empty">
                  <div className="db-empty__title">No active accounts</div>
                  <p className="db-empty__text">
                    You need an active account with funds before you can transfer.
                  </p>
                  <Link to="/accounts" className="db-btn db-btn--primary">
                    Open an account
                  </Link>
                </div>
              ) : (
                <form className="db-form" onSubmit={handleSubmit}>
                  <div className="field">
                    <label htmlFor="transfer-from">From</label>
                    <select
                      id="transfer-from"
                      className="input db-select"
                      value={form.fromAccountId}
                      onChange={update('fromAccountId')}
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
                    <label htmlFor="transfer-to">Destination account number</label>
                    <input
                      id="transfer-to"
                      className="input"
                      type="text"
                      inputMode="numeric"
                      maxLength={12}
                      placeholder="12-digit account number"
                      value={form.toAccountNumber}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          toAccountNumber: event.target.value.replace(/\D/g, ''),
                        }))
                      }
                    />
                    <div className="field-hint">
                      Tip: use one of your own account numbers to move money between accounts.
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="transfer-amount">Amount (₹)</label>
                    <input
                      id="transfer-amount"
                      className="input"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={update('amount')}
                    />
                    {fromAccount && (
                      <div className="field-hint">
                        Available balance: {formatMinor(fromAccount.balance)}
                      </div>
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="transfer-description">Description (optional)</label>
                    <input
                      id="transfer-description"
                      className="input"
                      type="text"
                      maxLength={140}
                      placeholder="Rent, split bill…"
                      value={form.description}
                      onChange={update('description')}
                    />
                  </div>

                  {formError && (
                    <div className="db-alert db-alert--error" role="alert">
                      {formError}
                    </div>
                  )}

                  <div className="db-form__actions">
                    <button type="submit" className="db-btn db-btn--primary" disabled={submitting}>
                      {submitting ? 'Sending…' : 'Send transfer'}
                      {!submitting && <ArrowRightIcon />}
                    </button>
                    <span className="db-form__hint">Double sends are blocked automatically.</span>
                  </div>
                </form>
              )}
            </section>

            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">What happens next</h2>
                  <p className="db-card__sub">A quick look at how the transfer is recorded.</p>
                </div>
              </div>

              <ul className="db-checks">
                <li>
                  <span className="db-checks__tick">1</span>
                  <span className="db-checks__label">Your account is debited</span>
                  <span className="db-checks__state">Instant</span>
                </li>
                <li>
                  <span className="db-checks__tick">2</span>
                  <span className="db-checks__label">The destination is credited</span>
                  <span className="db-checks__state">Instant</span>
                </li>
                <li>
                  <span className="db-checks__tick">3</span>
                  <span className="db-checks__label">Both ledger rows share one reference</span>
                  <span className="db-checks__state">Atomic</span>
                </li>
              </ul>

              <div className="db-kv">
                <div>
                  <dt>Source</dt>
                  <dd>{fromAccount ? maskAccount(fromAccount.accountNumber) : '—'}</dd>
                </div>
                <div>
                  <dt>Balance</dt>
                  <dd>{fromAccount ? formatMinor(fromAccount.balance) : '—'}</dd>
                </div>
                <div>
                  <dt>Fee</dt>
                  <dd>None</dd>
                </div>
              </div>

              <p className="db-note">
                If the destination account is frozen, the transfer is rejected and your money stays
                put. The debit and credit are committed together or not at all.
              </p>
            </section>
          </div>
        </>
      )}
    </AppShell>
  )
}
