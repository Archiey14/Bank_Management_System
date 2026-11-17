import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import Modal from '../components/Modal'
import { ArrowRightIcon } from '../components/appIcons'
import {
  createBeneficiary,
  createTransfer,
  deleteBeneficiary,
  getLimits,
  listAccounts,
  listBeneficiaries,
  newIdempotencyKey,
} from '../services/api'
import { formatMinor, toMinorUnits } from '../utils/money'
import { ACCOUNT_TYPE_LABELS, maskAccount } from '../utils/format'

const CATEGORIES = [
  'Direct Transfer',
  'Rent',
  'Bills & Utilities',
  'Family Support',
  'Education',
  'Investment',
  'Other',
]
const EMPTY_FORM = {
  fromAccountId: '',
  toAccountNumber: '',
  amount: '',
  category: CATEGORIES[0],
  description: '',
}
const EMPTY_PAYEE = { name: '', accountNumber: '', nickname: '' }

const nextFromAccountId = (list, currentId) => {
  const stillActive =
    currentId && list.some((account) => account._id === currentId && account.status === 'active')
  if (stillActive) return currentId
  return list.find((account) => account.status === 'active')?._id || ''
}

export default function Transfers() {
  const [accounts, setAccounts] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [limits, setLimits] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const idempotencyKey = useRef(newIdempotencyKey())

  const [showPayee, setShowPayee] = useState(false)
  const [payeeForm, setPayeeForm] = useState(EMPTY_PAYEE)
  const [payeeBusy, setPayeeBusy] = useState(false)
  const [payeeError, setPayeeError] = useState('')
  const [payeeNotice, setPayeeNotice] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      listAccounts(),
      listBeneficiaries().catch(() => ({ beneficiaries: [] })),
      getLimits().catch(() => null),
    ])
      .then(([accountData, beneficiaryData, limitData]) => {
        if (!active) return
        setAccounts(accountData.accounts)
        setBeneficiaries(beneficiaryData.beneficiaries)
        setLimits(limitData?.limits || null)
        setLoadError('')
        setForm((current) => ({
          ...current,
          fromAccountId: nextFromAccountId(accountData.accounts, current.fromAccountId),
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
  }, [reloadKey])

  const refresh = () => setReloadKey((key) => key + 1)
  const activeAccounts = accounts.filter((account) => account.status === 'active')
  const fromAccount = accounts.find((account) => account._id === form.fromAccountId)

  const transferRemaining = limits ? Math.max(0, limits.transfer.limit - limits.transfer.used) : null
  const usedPercent = limits
    ? Math.min(100, Math.round((limits.transfer.used / limits.transfer.limit) * 100))
    : 0

  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')
    setResult(null)

    if (!form.fromAccountId) {
      setFormError('Choose the account to transfer from.')
      return
    }
    const toAccountNumber = form.toAccountNumber.trim()
    if (!/^\d{12}$/.test(toAccountNumber)) {
      setFormError('Enter a valid 12-digit recipient account number.')
      return
    }
    if (fromAccount && fromAccount.accountNumber === toAccountNumber) {
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
        toAccountNumber,
        amountMinor,
        category: form.category,
        description: form.description.trim(),
        idempotencyKey: idempotencyKey.current,
      })
      idempotencyKey.current = newIdempotencyKey()
      setResult({ ...data, amountMinor, toAccountNumber })
      setForm((current) => ({ ...current, toAccountNumber: '', amount: '', description: '' }))
      refresh()
    } catch (err) {
      setFormError(err.response?.data?.message || 'Transfer failed. Please try again.')
      // A real response means the request was decided; the next attempt is new.
      if (err.response) idempotencyKey.current = newIdempotencyKey()
    } finally {
      setSubmitting(false)
    }
  }

  const payBeneficiary = (beneficiary) => {
    setResult(null)
    setFormError('')
    setForm((current) => ({ ...current, toAccountNumber: beneficiary.accountNumber }))
    document.getElementById('transfer-to')?.focus()
  }

  const openPayeeModal = () => {
    setPayeeForm(EMPTY_PAYEE)
    setPayeeError('')
    setShowPayee(true)
  }

  const handleAddPayee = async (event) => {
    event.preventDefault()
    setPayeeError('')
    setPayeeNotice('')
    if (payeeForm.name.trim().length < 2) {
      setPayeeError('Enter the payee’s full name.')
      return
    }
    if (!/^\d{12}$/.test(payeeForm.accountNumber.trim())) {
      setPayeeError('Enter a valid 12-digit account number.')
      return
    }
    setPayeeBusy(true)
    try {
      await createBeneficiary({
        name: payeeForm.name.trim(),
        accountNumber: payeeForm.accountNumber.trim(),
        nickname: payeeForm.nickname.trim(),
      })
      setShowPayee(false)
      setPayeeNotice('Payee saved. Tap “Pay” to start a transfer.')
      refresh()
    } catch (err) {
      setPayeeError(err.response?.data?.message || 'Could not save the payee.')
    } finally {
      setPayeeBusy(false)
    }
  }

  const handleDeletePayee = async (beneficiary) => {
    if (!window.confirm(`Remove ${beneficiary.name} from your payees?`)) return
    setPayeeNotice('')
    try {
      await deleteBeneficiary(beneficiary._id)
      setPayeeNotice('Payee removed.')
      refresh()
    } catch (err) {
      setPayeeNotice('')
      setFormError(err.response?.data?.message || 'Could not remove the payee.')
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Move money"
        title="Instant Fund Transfer"
        sub="Send money securely to Northbank accounts 24/7."
        actions={
          <>
            <Link to="/transactions" className="db-btn db-btn--outline">
              View ledger
            </Link>
            <button type="button" className="db-btn db-btn--primary" onClick={openPayeeModal}>
              + Add New Payee
            </button>
          </>
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
                refresh()
              }}
            >
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
          {payeeNotice && (
            <div className="db-alert db-alert--success" role="status">
              {payeeNotice}
            </div>
          )}

          <section className="db-card" style={{ marginTop: 20 }}>
            <div className="db-card__head">
              <div>
                <h2 className="db-card__title">Frequent payees ({beneficiaries.length})</h2>
                <p className="db-card__sub">Save accounts you pay often for 1-click transfers.</p>
              </div>
              <button type="button" className="db-btn db-btn--outline" onClick={openPayeeModal}>
                + New
              </button>
            </div>

            {beneficiaries.length === 0 ? (
              <p className="db-note" style={{ marginTop: 14 }}>
                No saved beneficiaries yet. Click “Add New Payee” to save accounts for 1-click transfers.
              </p>
            ) : (
              <div className="payee-strip">
                {beneficiaries.map((beneficiary) => (
                  <article className="payee-chip" key={beneficiary._id}>
                    <span className="bene-avatar">{beneficiary.name[0]?.toUpperCase()}</span>
                    <div className="payee-chip__info">
                      <div className="payee-chip__name">{beneficiary.nickname || beneficiary.name}</div>
                      <div className="payee-chip__acct">
                        {beneficiary.nickname ? `${beneficiary.name} · ` : ''}
                        {maskAccount(beneficiary.accountNumber)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="db-btn db-btn--primary"
                      onClick={() => payBeneficiary(beneficiary)}
                    >
                      Pay
                    </button>
                    <button
                      type="button"
                      className="db-btn db-btn--outline"
                      onClick={() => handleDeletePayee(beneficiary)}
                      aria-label={`Remove ${beneficiary.name}`}
                    >
                      ×
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="db-page-grid">
            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Transfer details</h2>
                  <p className="db-card__sub">Transfers post instantly and appear in your ledger.</p>
                </div>
              </div>

              {activeAccounts.length === 0 ? (
                <div className="db-empty">
                  <div className="db-empty__title">No active accounts</div>
                  <p className="db-empty__text">You need an active account with funds before you can transfer.</p>
                  <Link to="/accounts" className="db-btn db-btn--primary">
                    Open an account
                  </Link>
                </div>
              ) : (
                <form className="db-form" onSubmit={handleSubmit}>
                  <div className="field">
                    <label htmlFor="transfer-from">Debiting account</label>
                    <select
                      id="transfer-from"
                      className="input db-select"
                      value={form.fromAccountId}
                      onChange={setField('fromAccountId')}
                    >
                      {activeAccounts.map((account) => (
                        <option key={account._id} value={account._id}>
                          {account.accountNumber} — {ACCOUNT_TYPE_LABELS[account.type]?.toUpperCase()} (Available:{' '}
                          {formatMinor(account.balance)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="transfer-to">Recipient account number</label>
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

                  <div className="db-form__row">
                    <div className="field">
                      <label htmlFor="transfer-amount">Transfer amount (₹)</label>
                      <input
                        id="transfer-amount"
                        className="input"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={form.amount}
                        onChange={setField('amount')}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="transfer-category">Transfer category</label>
                      <select
                        id="transfer-category"
                        className="input db-select"
                        value={form.category}
                        onChange={setField('category')}
                      >
                        {CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="transfer-description">Remarks (optional)</label>
                    <input
                      id="transfer-description"
                      className="input"
                      type="text"
                      maxLength={140}
                      placeholder="Rent for November, split bill…"
                      value={form.description}
                      onChange={setField('description')}
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
                  <h2 className="db-card__title">Account limit &amp; protection</h2>
                </div>
              </div>

              <div className="limit-row">
                <span>Daily limit allowance</span>
                <strong>{limits ? formatMinor(limits.transfer.limit) : '—'}</strong>
              </div>
              {limits && (
                <>
                  <div className="limit-meter" aria-hidden="true">
                    <div
                      className={`limit-meter__bar${usedPercent >= 80 ? ' is-high' : ''}`}
                      style={{ width: `${usedPercent}%` }}
                    />
                  </div>
                  <div className="overview-row">
                    <span>Sent today: {formatMinor(limits.transfer.used)}</span>
                    <span>Left: {formatMinor(transferRemaining)}</span>
                  </div>
                </>
              )}
              <div className="field-hint" style={{ marginTop: 8 }}>
                Resets daily at 00:00 midnight IST. Transfers between your own accounts don’t use the limit.
              </div>

              {fromAccount && (
                <div className="overview-row" style={{ marginTop: 18 }}>
                  <span>Available in selected account</span>
                  <strong>{formatMinor(fromAccount.balance)}</strong>
                </div>
              )}

              <div className="secure-box">
                <strong>End-to-end encryption</strong>
                <span>
                  Every fund transfer is signed to your session and settled instantly on the Northbank ledger. The
                  debit and credit are committed together or not at all. Zero processing fees.
                </span>
              </div>
            </section>
          </div>
        </>
      )}

      {showPayee && (
        <Modal
          title="Add a new payee"
          sub="The account number must belong to an account at Northbank."
          onClose={() => {
            if (!payeeBusy) setShowPayee(false)
          }}
          busy={payeeBusy}
        >
          <form className="db-form" onSubmit={handleAddPayee} style={{ marginTop: 0 }}>
            <div className="field">
              <label htmlFor="payee-name">Full name</label>
              <input
                id="payee-name"
                className="input"
                type="text"
                placeholder="e.g. Asha Rao"
                value={payeeForm.name}
                onChange={(event) => setPayeeForm((current) => ({ ...current, name: event.target.value }))}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="payee-account">Account number</label>
              <input
                id="payee-account"
                className="input"
                type="text"
                inputMode="numeric"
                maxLength={12}
                placeholder="12-digit account number"
                value={payeeForm.accountNumber}
                onChange={(event) =>
                  setPayeeForm((current) => ({
                    ...current,
                    accountNumber: event.target.value.replace(/\D/g, ''),
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="payee-nick">Nickname (optional)</label>
              <input
                id="payee-nick"
                className="input"
                type="text"
                maxLength={30}
                placeholder="e.g. Rent, Dad"
                value={payeeForm.nickname}
                onChange={(event) => setPayeeForm((current) => ({ ...current, nickname: event.target.value }))}
              />
            </div>
            {payeeError && (
              <div className="db-alert db-alert--error" role="alert">
                {payeeError}
              </div>
            )}
            <div className="db-form__actions">
              <button type="submit" className="db-btn db-btn--primary" disabled={payeeBusy}>
                {payeeBusy ? 'Saving…' : 'Save payee'}
              </button>
              <button
                type="button"
                className="db-btn db-btn--outline"
                onClick={() => setShowPayee(false)}
                disabled={payeeBusy}
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  )
}
