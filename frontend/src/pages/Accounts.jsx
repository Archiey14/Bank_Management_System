import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import { ArrowRightIcon } from '../components/appIcons'
import {
  depositToAccount,
  listAccounts,
  listMyApplications,
  newIdempotencyKey,
  openAccount,
  updateAccount,
  withdrawFromAccount,
} from '../services/api'
import { formatMinor, toMinorUnits } from '../utils/money'
import {
  ACCOUNT_TYPE_LABELS,
  APPLICATION_STATUS_LABELS,
  formatDate,
  maskAccount,
} from '../utils/format'

const ACCOUNT_TYPES = ['savings', 'current', 'fixed_deposit']

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')

  // Filter & Search state
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Create account state
  const [type, setType] = useState('savings')
  const [nickname, setNickname] = useState('')
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState('')
  const [showOpenForm, setShowOpenForm] = useState(false)

  // Deposit state
  const [depositForm, setDepositForm] = useState({ accountId: '', amount: '', description: '' })
  const [depositing, setDepositing] = useState(false)
  const [depositError, setDepositError] = useState('')
  const depositKey = useRef(newIdempotencyKey())

  // Withdraw state
  const [withdrawForm, setWithdrawForm] = useState({ accountId: '', amount: '', description: '' })
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  const withdrawKey = useRef(newIdempotencyKey())

  // Selected account for Details modal
  const [detailAccount, setDetailAccount] = useState(null)
  const [copied, setCopied] = useState(false)

  // Edit nickname modal state
  const [editingAccount, setEditingAccount] = useState(null)
  const [editNickname, setEditNickname] = useState('')
  const [savingNickname, setSavingNickname] = useState(false)
  const [editError, setEditError] = useState('')

  const fetchAccounts = async (showSpinner = false) => {
    if (showSpinner) {
      setLoading(true)
      setLoadError('')
    }
    try {
      const data = await listAccounts()
      setAccounts(data.accounts)
      setLoadError('')
      if (data.accounts.length > 0) {
        const active = data.accounts.find((a) => a.status === 'active') || data.accounts[0]
        setDepositForm((curr) => ({ ...curr, accountId: curr.accountId || active._id }))
        setWithdrawForm((curr) => ({ ...curr, accountId: curr.accountId || active._id }))
      }
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load your accounts.')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    Promise.all([listAccounts(), listMyApplications()])
      .then(([accountsData, applicationsData]) => {
        if (!active) return
        setAccounts(accountsData.accounts)
        setApplications(applicationsData.applications)
        setLoadError('')
        if (accountsData.accounts.length > 0) {
          const firstActive =
            accountsData.accounts.find((a) => a.status === 'active') || accountsData.accounts[0]
          setDepositForm((curr) => ({ ...curr, accountId: firstActive._id }))
          setWithdrawForm((curr) => ({ ...curr, accountId: firstActive._id }))
        }
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

  const openNewAccountForm = () => {
    setOpenError('')
    setNotice('')
    setShowOpenForm(true)
  }

  const closeNewAccountForm = () => {
    if (opening) return
    setShowOpenForm(false)
    setOpenError('')
  }

  // Close the popup with the Escape key
  useEffect(() => {
    if (!showOpenForm) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setShowOpenForm(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showOpenForm])

  // Create new account
  const handleOpen = async (event) => {
    event.preventDefault()
    setOpenError('')
    setNotice('')
    setOpening(true)
    try {
      const data = await openAccount(type, nickname.trim())
      setNotice(
        `Opened ${ACCOUNT_TYPE_LABELS[data.account.type]} account ${maskAccount(
          data.account.accountNumber
        )}${data.account.nickname ? ` ("${data.account.nickname}")` : ''}.`
      )
      setNickname('')
      setType('savings')
      setShowOpenForm(false)
      await fetchAccounts(false)
    } catch (err) {
      setOpenError(err.response?.data?.message || 'Could not open the account.')
    } finally {
      setOpening(false)
    }
  }

  // Deposit
  const handleDeposit = async (event) => {
    event.preventDefault()
    setDepositError('')
    setNotice('')

    if (!depositForm.accountId) {
      setDepositError('Choose an account to deposit into.')
      return
    }
    const amountMinor = toMinorUnits(depositForm.amount)
    if (!amountMinor || amountMinor <= 0) {
      setDepositError('Enter an amount greater than zero.')
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
          ? 'Deposit already processed.'
          : `Deposited ${formatMinor(amountMinor)} successfully.`
      )
      await fetchAccounts(false)
    } catch (err) {
      setDepositError(err.response?.data?.message || 'Deposit failed. Please try again.')
      if (err.response) depositKey.current = newIdempotencyKey()
    } finally {
      setDepositing(false)
    }
  }

  // Withdraw
  const handleWithdraw = async (event) => {
    event.preventDefault()
    setWithdrawError('')
    setNotice('')

    if (!withdrawForm.accountId) {
      setWithdrawError('Choose an account to withdraw from.')
      return
    }
    const amountMinor = toMinorUnits(withdrawForm.amount)
    if (!amountMinor || amountMinor <= 0) {
      setWithdrawError('Enter an amount greater than zero.')
      return
    }

    const selectedAcc = accounts.find((a) => a._id === withdrawForm.accountId)
    if (selectedAcc && selectedAcc.balance < amountMinor) {
      setWithdrawError(
        `Insufficient funds. Available balance: ${formatMinor(selectedAcc.balance)}.`
      )
      return
    }

    setWithdrawing(true)
    try {
      const data = await withdrawFromAccount(withdrawForm.accountId, {
        amountMinor,
        description: withdrawForm.description.trim(),
        idempotencyKey: withdrawKey.current,
      })
      withdrawKey.current = newIdempotencyKey()
      setWithdrawForm((current) => ({ ...current, amount: '', description: '' }))
      setNotice(
        data.replayed
          ? 'Withdrawal already processed.'
          : `Withdrew ${formatMinor(amountMinor)} successfully.`
      )
      await fetchAccounts(false)
    } catch (err) {
      setWithdrawError(err.response?.data?.message || 'Withdrawal failed. Please check funds.')
      if (err.response) withdrawKey.current = newIdempotencyKey()
    } finally {
      setWithdrawing(false)
    }
  }

  // Edit Nickname
  const handleSaveNickname = async (e) => {
    e.preventDefault()
    if (!editingAccount) return
    setEditError('')
    setSavingNickname(true)
    try {
      const updated = await updateAccount(editingAccount._id, {
        nickname: editNickname.trim(),
      })
      setNotice(`Updated account label to "${updated.account.nickname || 'none'}".`)
      setEditingAccount(null)
      if (detailAccount?._id === updated.account._id) {
        setDetailAccount(updated.account)
      }
      await fetchAccounts(false)
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update nickname.')
    } finally {
      setSavingNickname(false)
    }
  }

  // Filter accounts
  const filteredAccounts = accounts.filter((acc) => {
    if (typeFilter && acc.type !== typeFilter) return false
    if (statusFilter && acc.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchNum = acc.accountNumber?.toLowerCase().includes(q)
      const matchNick = acc.nickname?.toLowerCase().includes(q)
      if (!matchNum && !matchNick) return false
    }
    return true
  })

  const activeAccounts = accounts.filter((account) => account.status === 'active')

  // One entry point for opening accounts, decided by the customer's state:
  // first account -> full KYC application (staff review); later accounts -> instant popup.
  const isKycVerified = applications.some((application) => application.status === 'approved')
  const hasPendingApplication = applications.some((application) => application.status === 'pending')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Banking Management"
        title="Accounts"
        sub="Open new bank accounts, inspect full details, update account labels and manage deposits and withdrawals."
        actions={
          <>
            {isKycVerified ? (
              <button type="button" className="db-btn db-btn--primary" onClick={openNewAccountForm}>
                + Open New Account
              </button>
            ) : hasPendingApplication ? (
              <button
                type="button"
                className="db-btn db-btn--outline"
                disabled
                title="Your application is being reviewed by the bank"
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              >
                Application under review
              </button>
            ) : (
              <Link to="/apply" className="db-btn db-btn--primary">
                + Open New Account
              </Link>
            )}
            <Link to="/transfers" className="db-btn db-btn--outline">
              Transfer Funds
              <ArrowRightIcon />
            </Link>
          </>
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
          {/* Account Filter & Search */}
          <section className="db-card" style={{ marginTop: 20 }}>
            <div className="db-card__head">
              <div>
                <h2 className="db-card__title">Existing Accounts ({filteredAccounts.length})</h2>
                <p className="db-card__sub">
                  Click any account card to view full details or edit its label.
                </p>
              </div>
            </div>

            <div className="db-filters" style={{ marginTop: 12 }}>
              <div className="field db-filters__wide">
                <label htmlFor="acct-search">Search Account</label>
                <input
                  id="acct-search"
                  className="input"
                  placeholder="Search by account number or label"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="filter-type">Account Type</label>
                <select
                  id="filter-type"
                  className="input db-select"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="savings">Savings</option>
                  <option value="current">Current</option>
                  <option value="fixed_deposit">Fixed Deposit</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="filter-status">Status</label>
                <select
                  id="filter-status"
                  className="input db-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="frozen">Frozen</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {filteredAccounts.length === 0 ? (
              <div className="db-empty">
                <div className="db-empty__title">No matching accounts</div>
                <p className="db-empty__text">
                  {accounts.length === 0
                    ? 'You have not opened any accounts yet.'
                    : 'Try clearing your search query or filters.'}
                </p>
                {accounts.length === 0 &&
                  !hasPendingApplication &&
                  (isKycVerified ? (
                    <button type="button" className="db-btn db-btn--primary" onClick={openNewAccountForm}>
                      Open your first account
                    </button>
                  ) : (
                    <Link to="/apply" className="db-btn db-btn--primary">
                      Open your first account
                    </Link>
                  ))}
              </div>
            ) : (
              <div className="acct-grid">
                {filteredAccounts.map((account) => (
                  <article
                    className="acct-card"
                    key={account._id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setDetailAccount(account)
                      setCopied(false)
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 30 }}>
                      <span className="acct-card__type">
                        {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                      </span>
                      {account.nickname && (
                        <span
                          className="pill pill--completed"
                          style={{ fontSize: '0.72rem', textTransform: 'none' }}
                        >
                          {account.nickname}
                        </span>
                      )}
                    </div>
                    <div className="acct-card__num">{maskAccount(account.accountNumber)}</div>
                    <div className="acct-card__balance">{formatMinor(account.balance)}</div>
                    <div className="acct-card__foot">
                      <span className={`pill pill--${account.status}`}>{account.status}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                        Click to inspect →
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Pending Applications Section */}
          {applications.length > 0 && (
            <section className="db-card" style={{ marginTop: 20 }}>
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Your Account Applications</h2>
                  <p className="db-card__sub">
                    Track the verification status of your submitted applications.
                  </p>
                </div>
              </div>

              <div className="db-table-wrap">
                <table className="db-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Account type</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application._id}>
                        <td>{application.applicationNumber}</td>
                        <td>
                          {ACCOUNT_TYPE_LABELS[application.accountType] || application.accountType}
                        </td>
                        <td>{formatDate(application.createdAt)}</td>
                        <td>
                          <span className={`pill pill--${application.status}`}>
                            {APPLICATION_STATUS_LABELS[application.status] || application.status}
                          </span>
                        </td>
                        <td>{application.remarks || (application.status === 'pending' ? 'Under Review' : '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Actions Grid: Deposit and Withdraw */}
          <div className="db-page-grid db-page-grid--equal">
            {/* Deposit Money Form */}
            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Deposit Funds</h2>
                  <p className="db-card__sub">Add funds to one of your active accounts.</p>
                </div>
              </div>

              {activeAccounts.length === 0 ? (
                <div className="db-empty">
                  <div className="db-empty__title">No active accounts</div>
                  <p className="db-empty__text">Open an active account first to deposit.</p>
                </div>
              ) : (
                <form className="db-form" onSubmit={handleDeposit}>
                  <div className="field">
                    <label htmlFor="deposit-account">Destination Account</label>
                    <select
                      id="deposit-account"
                      className="input db-select"
                      value={depositForm.accountId}
                      onChange={(e) =>
                        setDepositForm((curr) => ({ ...curr, accountId: e.target.value }))
                      }
                    >
                      {activeAccounts.map((acc) => (
                        <option key={acc._id} value={acc._id}>
                          {ACCOUNT_TYPE_LABELS[acc.type]} {maskAccount(acc.accountNumber)}
                          {acc.nickname ? ` (${acc.nickname})` : ''} · {formatMinor(acc.balance)}
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
                      onChange={(e) =>
                        setDepositForm((curr) => ({ ...curr, amount: e.target.value }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="deposit-description">Description</label>
                    <input
                      id="deposit-description"
                      className="input"
                      type="text"
                      maxLength={140}
                      placeholder="Savings deposit, paycheck top-up…"
                      value={depositForm.description}
                      onChange={(e) =>
                        setDepositForm((curr) => ({ ...curr, description: e.target.value }))
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
                      {depositing ? 'Processing…' : 'Deposit Money'}
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* Withdraw Funds */}
            <section className="db-card">
            <div className="db-card__head">
              <div>
                <h2 className="db-card__title">Withdraw Funds</h2>
                <p className="db-card__sub">
                  Withdraw funds from your active account. Overdrafts are strictly prevented.
                </p>
              </div>
            </div>

            {activeAccounts.length === 0 ? (
              <div className="db-empty">
                <div className="db-empty__title">No active accounts</div>
                <p className="db-empty__text">Open an active account first to withdraw.</p>
              </div>
            ) : (
              <form className="db-form" onSubmit={handleWithdraw}>
                <div className="field">
                  <label htmlFor="withdraw-account">Source Account</label>
                  <select
                    id="withdraw-account"
                    className="input db-select"
                    value={withdrawForm.accountId}
                    onChange={(e) =>
                      setWithdrawForm((curr) => ({ ...curr, accountId: e.target.value }))
                    }
                  >
                    {activeAccounts.map((acc) => (
                      <option key={acc._id} value={acc._id}>
                        {ACCOUNT_TYPE_LABELS[acc.type]} {maskAccount(acc.accountNumber)}
                        {acc.nickname ? ` (${acc.nickname})` : ''} · Balance: {formatMinor(acc.balance)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="withdraw-amount">Withdrawal Amount (₹)</label>
                  <input
                    id="withdraw-amount"
                    className="input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={withdrawForm.amount}
                    onChange={(e) =>
                      setWithdrawForm((curr) => ({ ...curr, amount: e.target.value }))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="withdraw-description">Note</label>
                  <input
                    id="withdraw-description"
                    className="input"
                    type="text"
                    maxLength={140}
                    placeholder="ATM withdrawal, cash usage…"
                    value={withdrawForm.description}
                    onChange={(e) =>
                      setWithdrawForm((curr) => ({ ...curr, description: e.target.value }))
                    }
                  />
                </div>

                {withdrawError && (
                  <div className="db-alert db-alert--error" role="alert">
                    {withdrawError}
                  </div>
                )}

                <div className="db-form__actions">
                  <button type="submit" className="db-btn db-btn--primary" disabled={withdrawing}>
                    {withdrawing ? 'Processing…' : 'Withdraw Funds'}
                  </button>
                </div>
              </form>
            )}
          </section>
          </div>
        </>
      )}

      {/* Open Account Modal */}
      {showOpenForm && (
        <div
          className="cookie-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="open-account-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeNewAccountForm()
          }}
        >
          <div className="cookie-modal" style={{ maxWidth: 480 }}>
            <div className="cookie-modal__head">
              <div>
                <h3 className="cookie-modal__title" id="open-account-title">
                  Open a New Account
                </h3>
                <p className="cookie-modal__sub">
                  Your identity is already verified, so this opens instantly.
                </p>
              </div>
              <button
                type="button"
                className="cookie-modal__close"
                onClick={closeNewAccountForm}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <form className="db-form" onSubmit={handleOpen} style={{ marginTop: 0 }}>
              <div className="field">
                <label htmlFor="open-type">Account Type</label>
                <select
                  id="open-type"
                  className="input db-select"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  autoFocus
                >
                  {ACCOUNT_TYPES.map((val) => (
                    <option key={val} value={val}>
                      {ACCOUNT_TYPE_LABELS[val]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="open-nickname">Account Label / Nickname (Optional)</label>
                <input
                  id="open-nickname"
                  className="input"
                  placeholder="e.g. Household Bills, Emergency Fund"
                  maxLength={50}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>

              {openError && (
                <div className="db-alert db-alert--error" role="alert">
                  {openError}
                </div>
              )}

              <div className="db-form__actions">
                <button type="submit" className="db-btn db-btn--primary" disabled={opening}>
                  {opening ? 'Opening…' : 'Open Account'}
                </button>
                <button
                  type="button"
                  className="db-btn db-btn--outline"
                  onClick={closeNewAccountForm}
                  disabled={opening}
                >
                  Cancel
                </button>
                <span className="db-form__hint">Limit 5 open accounts per customer.</span>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Details Modal */}
      {detailAccount && (
        <div className="cookie-modal-backdrop" role="dialog" aria-modal="true">
          <div className="cookie-modal" style={{ maxWidth: 540 }}>
            <div className="cookie-modal__head">
              <div>
                <h3 className="cookie-modal__title">Account Details</h3>
                <p className="cookie-modal__sub">
                  Full specifications and identifiers for this account.
                </p>
              </div>
              <button
                type="button"
                className="cookie-modal__close"
                onClick={() => setDetailAccount(null)}
              >
                &times;
              </button>
            </div>

            <dl className="db-kv">
              <div>
                <dt>Account Number</dt>
                <dd style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.05rem' }}>
                    {detailAccount.accountNumber}
                  </span>
                  <button
                    type="button"
                    className="db-btn db-btn--outline"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => {
                      navigator.clipboard?.writeText(detailAccount.accountNumber)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </dd>
              </div>
              <div>
                <dt>Account Label</dt>
                <dd style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{detailAccount.nickname || 'None set'}</span>
                  <button
                    type="button"
                    className="db-btn db-btn--outline"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => {
                      setEditingAccount(detailAccount)
                      setEditNickname(detailAccount.nickname || '')
                    }}
                  >
                    Edit Label
                  </button>
                </dd>
              </div>
              <div>
                <dt>Account Type</dt>
                <dd>{ACCOUNT_TYPE_LABELS[detailAccount.type] || detailAccount.type}</dd>
              </div>
              <div>
                <dt>Current Balance</dt>
                <dd style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)' }}>
                  {formatMinor(detailAccount.balance)}
                </dd>
              </div>
              <div>
                <dt>Account Status</dt>
                <dd>
                  <span className={`pill pill--${detailAccount.status}`}>
                    {detailAccount.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Currency</dt>
                <dd>{detailAccount.currency || 'INR'}</dd>
              </div>
              <div>
                <dt>Date Opened</dt>
                <dd>{formatDate(detailAccount.createdAt)}</dd>
              </div>
            </dl>

            <div className="db-form__actions" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="db-btn db-btn--primary"
                onClick={() => {
                  setDepositForm((curr) => ({ ...curr, accountId: detailAccount._id }))
                  setDetailAccount(null)
                  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
                }}
              >
                Deposit to Account
              </button>
              <button
                type="button"
                className="db-btn db-btn--outline"
                onClick={() => {
                  setWithdrawForm((curr) => ({ ...curr, accountId: detailAccount._id }))
                  setDetailAccount(null)
                  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
                }}
              >
                Withdraw from Account
              </button>
              <button
                type="button"
                className="db-btn db-btn--outline"
                onClick={() => setDetailAccount(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Nickname Modal */}
      {editingAccount && (
        <div className="cookie-modal-backdrop" role="dialog" aria-modal="true">
          <div className="cookie-modal" style={{ maxWidth: 460 }}>
            <div className="cookie-modal__head">
              <div>
                <h3 className="cookie-modal__title">Edit Account Label</h3>
                <p className="cookie-modal__sub">
                  Set a friendly nickname for {maskAccount(editingAccount.accountNumber)}.
                </p>
              </div>
              <button
                type="button"
                className="cookie-modal__close"
                onClick={() => setEditingAccount(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveNickname} className="db-form">
              {editError && (
                <div className="db-alert db-alert--error" role="alert">
                  {editError}
                </div>
              )}

              <div className="field">
                <label htmlFor="edit-nick-input">Nickname / Label</label>
                <input
                  id="edit-nick-input"
                  className="input"
                  placeholder="e.g. Vacation Savings"
                  maxLength={50}
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                />
              </div>

              <div className="db-form__actions" style={{ marginTop: 16 }}>
                <button
                  type="submit"
                  className="db-btn db-btn--primary"
                  disabled={savingNickname}
                >
                  {savingNickname ? 'Saving…' : 'Save Label'}
                </button>
                <button
                  type="button"
                  className="db-btn db-btn--outline"
                  onClick={() => setEditingAccount(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
