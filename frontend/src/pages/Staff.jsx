import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import { useAuth } from '../context/authStore'
import {
  approveApplication,
  depositToAccount,
  getStaffOverview,
  listApplications,
  listFlaggedTransfers,
  listStaffAccounts,
  newIdempotencyKey,
  rejectApplication,
  reviewFlaggedTransfer,
  setAccountStatus,
  staffOpenAccount,
  withdrawFromAccount,
} from '../services/api'
import { formatMinor, toMinorUnits } from '../utils/money'
import {
  ACCOUNT_TYPE_LABELS,
  APPLICATION_STATUS_LABELS,
  formatDate,
  formatDateTime,
  incomeBandLabel,
  maskAccount,
} from '../utils/format'

const DIRECTORY_STATUSES = ['active', 'frozen', 'closed']
const ACCOUNT_TYPES = ['savings', 'current', 'fixed_deposit']

export default function Staff() {
  const { user } = useAuth()
  const isStaff = user?.role === 'staff' || user?.role === 'admin'

  const [activeTab, setActiveTab] = useState('directory') // 'directory' | 'queue' | 'flagged'

  const [overview, setOverview] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [queue, setQueue] = useState([])
  const [rejectingId, setRejectingId] = useState('')
  const [remarks, setRemarks] = useState('')
  const [actingId, setActingId] = useState('')
  const [freezingId, setFreezingId] = useState('')

  // Open Account for Customer modal
  const [openModalOpen, setOpenModalOpen] = useState(false)
  const [newAccountForm, setNewAccountForm] = useState({
    customerEmail: '',
    type: 'savings',
    nickname: '',
  })
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [openModalError, setOpenModalError] = useState('')

  // Counter Deposit / Withdrawal modal
  const [moneyModal, setMoneyModal] = useState({
    open: false,
    kind: 'deposit', // 'deposit' | 'withdrawal'
    account: null,
    amount: '',
    description: '',
    error: '',
    busy: false,
  })
  const staffMoneyKey = useRef(newIdempotencyKey())

  // Flagged Transfers state
  const [flaggedList, setFlaggedList] = useState([])
  const [flaggedFilter, setFlaggedFilter] = useState('pending')
  const [loadingFlagged, setLoadingFlagged] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewingTxId, setReviewingTxId] = useState('')

  // KYC Document Preview Modal
  const [docModal, setDocModal] = useState({ open: false, title: '', src: '' })

  const load = async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true)
      setError('')
    }
    try {
      const [overviewData, accountsData] = await Promise.all([
        getStaffOverview(7),
        listStaffAccounts({ status: statusFilter, q: search.trim() }),
      ])
      setOverview(overviewData)
      setAccounts(accountsData.accounts || [])
      setQueue(overviewData.recentApplications || [])
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the staff desk.')
    } finally {
      setLoading(false)
    }
  }

  const loadFlagged = async () => {
    try {
      setLoadingFlagged(true)
      const data = await listFlaggedTransfers({ status: flaggedFilter })
      setFlaggedList(data.transfers)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load flagged transfers.')
    } finally {
      setLoadingFlagged(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (activeTab === 'flagged') {
      loadFlagged()
    } else if (activeTab === 'queue') {
      refreshQueue().catch(() => {})
    }
  }, [activeTab, flaggedFilter])

  const refreshQueue = async () => {
    const data = await listApplications({ status: 'pending', limit: 10 })
    setQueue(
      [...data.applications].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    )
  }

  const handleApprove = async (application) => {
    setActingId(application._id)
    setNotice('')
    setError('')
    try {
      await approveApplication(application._id)
      setNotice(`${application.applicationNumber} approved — account opened.`)
      await Promise.all([refreshQueue(), load(false)])
    } catch (err) {
      setError(err.response?.data?.message || 'Could not approve the application.')
    } finally {
      setActingId('')
    }
  }

  const handleReject = async (application) => {
    if (remarks.trim().length < 3) {
      setError('Add a short remark explaining the rejection.')
      return
    }
    setActingId(application._id)
    setNotice('')
    setError('')
    try {
      await rejectApplication(application._id, remarks.trim())
      setNotice(`${application.applicationNumber} rejected.`)
      setRejectingId('')
      setRemarks('')
      await refreshQueue()
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reject the application.')
    } finally {
      setActingId('')
    }
  }

  const handleFreezeToggle = async (account) => {
    const next = account.status === 'frozen' ? 'active' : 'frozen'
    setFreezingId(account._id)
    setNotice('')
    setError('')
    try {
      await setAccountStatus(account._id, next)
      setNotice(
        `${maskAccount(account.accountNumber)} ${next === 'frozen' ? 'frozen' : 'unfrozen'}.`
      )
      await load(false)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update the account.')
    } finally {
      setFreezingId('')
    }
  }

  // Open account for customer submit
  const handleOpenForCustomer = async (e) => {
    e.preventDefault()
    setOpenModalError('')
    if (!newAccountForm.customerEmail.trim()) {
      return setOpenModalError('Enter customer email.')
    }
    setCreatingAccount(true)
    try {
      const res = await staffOpenAccount({
        customerEmail: newAccountForm.customerEmail.trim(),
        type: newAccountForm.type,
        nickname: newAccountForm.nickname.trim(),
      })
      setNotice(`Account ${maskAccount(res.account.accountNumber)} opened for customer.`)
      setOpenModalOpen(false)
      setNewAccountForm({ customerEmail: '', type: 'savings', nickname: '' })
      load(false)
    } catch (err) {
      setOpenModalError(err.response?.data?.message || 'Failed to open account for customer.')
    } finally {
      setCreatingAccount(false)
    }
  }

  // Counter deposit / withdraw submit
  const handleMoneySubmit = async (e) => {
    e.preventDefault()
    setMoneyModal((curr) => ({ ...curr, error: '' }))
    const amountMinor = toMinorUnits(moneyModal.amount)
    if (!amountMinor || amountMinor <= 0) {
      return setMoneyModal((curr) => ({ ...curr, error: 'Enter a valid amount.' }))
    }

    if (moneyModal.kind === 'withdrawal' && moneyModal.account?.balance < amountMinor) {
      return setMoneyModal((curr) => ({
        ...curr,
        error: `Insufficient funds. Account balance: ${formatMinor(moneyModal.account.balance)}.`,
      }))
    }

    setMoneyModal((curr) => ({ ...curr, busy: true }))
    try {
      if (moneyModal.kind === 'deposit') {
        await depositToAccount(moneyModal.account._id, {
          amountMinor,
          description: moneyModal.description.trim() || 'Counter Deposit',
          idempotencyKey: staffMoneyKey.current,
        })
        setNotice(`Deposited ${formatMinor(amountMinor)} into ${maskAccount(moneyModal.account.accountNumber)}.`)
      } else {
        await withdrawFromAccount(moneyModal.account._id, {
          amountMinor,
          description: moneyModal.description.trim() || 'Counter Withdrawal',
          idempotencyKey: staffMoneyKey.current,
          isStaffAction: true,
        })
        setNotice(`Withdrew ${formatMinor(amountMinor)} from ${maskAccount(moneyModal.account.accountNumber)}.`)
      }
      staffMoneyKey.current = newIdempotencyKey()
      setMoneyModal({ open: false, kind: 'deposit', account: null, amount: '', description: '', error: '', busy: false })
      load(false)
    } catch (err) {
      setMoneyModal((curr) => ({
        ...curr,
        error: err.response?.data?.message || 'Operation failed. Please check funds.',
        busy: false,
      }))
      if (err.response) staffMoneyKey.current = newIdempotencyKey()
    }
  }

  // Review Flagged Transfer
  const handleReviewFlagged = async (txId, reviewStatus) => {
    setError('')
    setNotice('')
    setReviewingTxId(txId)
    try {
      await reviewFlaggedTransfer(txId, {
        reviewStatus,
        reviewNote: reviewNote.trim(),
      })
      setNotice(`Flagged transfer marked as ${reviewStatus}.`)
      setReviewNote('')
      loadFlagged()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to review transfer.')
    } finally {
      setReviewingTxId('')
    }
  }

  if (!isStaff) {
    return (
      <AppShell>
        <PageHeader eyebrow="Staff desk" title="Staff only" />
        <div className="db-alert db-alert--error" role="alert">
          This area is for bank staff. <Link to="/dashboard">Back to your overview</Link>.
        </div>
      </AppShell>
    )
  }

  const totals = overview?.totals

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operations Desk"
        title="Bank Operations"
        sub="Customer directory, application processing, counter deposits/withdrawals, and flagged transaction reviews."
        actions={
          <button
            type="button"
            className="db-btn db-btn--primary"
            onClick={() => {
              setOpenModalError('')
              setOpenModalOpen(true)
            }}
          >
            + Open Account for Customer
          </button>
        }
      />

      {notice && (
        <div className="db-alert db-alert--success" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="db-alert db-alert--error" role="alert">
          {error}
        </div>
      )}

      {loading && <div className="db-loading">Loading the staff desk…</div>}

      {!loading && overview && (
        <>
          <div className="db-stats" style={{ marginTop: 20 }}>
            <div className="db-stat">
              <div className="db-stat__num">{totals.customers}</div>
              <div className="db-stat__cap">Customers · {totals.newCustomers} new this week</div>
            </div>
            <div className="db-stat">
              <div className="db-stat__num">{totals.openAccounts}</div>
              <div className="db-stat__cap">Open accounts</div>
            </div>
            <div className="db-stat">
              <div className="db-stat__num">{formatMinor(totals.totalBalanceMinor)}</div>
              <div className="db-stat__cap">Total balances held</div>
            </div>
            <div
              className="db-stat"
              style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
              onClick={() => setActiveTab('queue')}
              title="Click to view Application Queue"
            >
              <div className="db-stat__num">{overview.pendingApplications}</div>
              <div className="db-stat__cap">Applications awaiting review →</div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="db-tab-bar" role="tablist" aria-label="Staff sections">
            <button
              type="button"
              className={`db-chiptab${activeTab === 'directory' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('directory')}
            >
              Customer Directory ({accounts.length})
            </button>
            <button
              type="button"
              className={`db-chiptab${activeTab === 'queue' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('queue')}
            >
              Application Queue ({queue.length})
            </button>
            <button
              type="button"
              className={`db-chiptab${activeTab === 'flagged' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('flagged')}
            >
              Flagged Transfers
            </button>
          </div>

          {/* Tab 1: Customer Directory */}
          {activeTab === 'directory' && (
            <section className="db-card" style={{ marginTop: 20 }}>
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Customer Accounts Directory</h2>
                  <p className="db-card__sub">
                    Lookup customer accounts, process counter deposits/withdrawals, or freeze accounts.
                  </p>
                </div>
              </div>

              <form
                className="db-filters db-filters--inline"
                onSubmit={(event) => {
                  event.preventDefault()
                  load(true)
                }}
              >
                <div className="field" style={{ flex: '1 1 240px', minWidth: 200, maxWidth: 360 }}>
                  <label htmlFor="staff-search">Search Account Number</label>
                  <input
                    id="staff-search"
                    className="input"
                    inputMode="numeric"
                    placeholder="Search by account number"
                    value={search}
                    onChange={(event) => setSearch(event.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div className="field" style={{ flex: '0 1 180px', minWidth: 140 }}>
                  <label htmlFor="staff-status">Status</label>
                  <select
                    id="staff-status"
                    className="input db-select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="">Any status</option>
                    {DIRECTORY_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ margin: 0, alignSelf: 'flex-end' }}>
                  <button type="submit" className="db-btn db-btn--primary">
                    Search
                  </button>
                </div>
                {(search || statusFilter) && (
                  <div className="field" style={{ margin: 0, alignSelf: 'flex-end' }}>
                    <button
                      type="button"
                      className="db-btn"
                      onClick={() => {
                        setSearch('')
                        setStatusFilter('')
                        setTimeout(() => load(true), 0)
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </form>

              {accounts.length === 0 ? (
                <div className="db-empty">
                  <div className="db-empty__title">No accounts found</div>
                  <p className="db-empty__text">Try clearing the search or status filter.</p>
                </div>
              ) : (
                <div className="db-table-wrap">
                  <table className="db-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Account</th>
                        <th>Type</th>
                        <th className="num">Balance</th>
                        <th>Status</th>
                        <th>Counter Actions</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account) => (
                        <tr key={account._id}>
                          <td>
                            <div className="db-table__title">{account.user?.name || '—'}</div>
                            <div className="db-table__sub">{account.user?.email || '—'}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{account.accountNumber}</div>
                            {account.nickname && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                {account.nickname}
                              </div>
                            )}
                          </td>
                          <td>{ACCOUNT_TYPE_LABELS[account.type] || account.type}</td>
                          <td className="num">{formatMinor(account.balance)}</td>
                          <td>
                            <span className={`pill pill--${account.status}`}>{account.status}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="db-btn db-btn--outline"
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                                onClick={() =>
                                  setMoneyModal({
                                    open: true,
                                    kind: 'deposit',
                                    account,
                                    amount: '',
                                    description: '',
                                    error: '',
                                    busy: false,
                                  })
                                }
                                disabled={account.status !== 'active'}
                              >
                                Deposit
                              </button>
                              <button
                                type="button"
                                className="db-btn db-btn--outline"
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                                onClick={() =>
                                  setMoneyModal({
                                    open: true,
                                    kind: 'withdrawal',
                                    account,
                                    amount: '',
                                    description: '',
                                    error: '',
                                    busy: false,
                                  })
                                }
                                disabled={account.status !== 'active'}
                              >
                                Withdraw
                              </button>
                            </div>
                          </td>
                          <td>
                            {account.status !== 'closed' && (
                              <button
                                type="button"
                                className="db-btn db-btn--outline"
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                                onClick={() => handleFreezeToggle(account)}
                                disabled={freezingId === account._id}
                              >
                                {freezingId === account._id
                                  ? '…'
                                  : account.status === 'frozen'
                                    ? 'Unfreeze'
                                    : 'Freeze'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Tab 2: Application Review Queue */}
          {activeTab === 'queue' && (
            <section className="db-card" style={{ marginTop: 20 }}>
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Application Review Queue</h2>
                  <p className="db-card__sub">
                    Oldest first. Approving opens the account and credits any opening deposit.
                  </p>
                </div>
              </div>

              {queue.length === 0 ? (
                <div className="db-empty">
                  <div className="db-empty__title">Queue is clear</div>
                  <p className="db-empty__text">No applications are waiting for review.</p>
                </div>
              ) : (
                queue.map((application) => (
                  <article className="db-card" key={application._id} style={{ marginTop: 12 }}>
                    <div className="db-card__head">
                      <div>
                        <h3 className="db-card__title">
                          {application.applicationNumber} ·{' '}
                          {ACCOUNT_TYPE_LABELS[application.accountType] || application.accountType}
                        </h3>
                        <p className="db-card__sub">
                          {application.user?.name || 'Customer'} ({application.user?.email || '—'}) ·
                          submitted {formatDate(application.createdAt)}
                        </p>
                      </div>
                      <span className="pill pill--pending">
                        {APPLICATION_STATUS_LABELS[application.status]}
                      </span>
                    </div>

                    <dl className="db-kv">
                      <div>
                        <dt>Date of birth</dt>
                        <dd>{formatDate(application.dob)}</dd>
                      </div>
                      <div>
                        <dt>Mobile</dt>
                        <dd>+91 {application.phone}</dd>
                      </div>
                      <div>
                        <dt>PAN</dt>
                        <dd>
                          {application.pan && application.pan !== 'DOC_ATTACHED'
                            ? application.pan
                            : 'Verified from document'}
                        </dd>
                      </div>
                      <div>
                        <dt>Occupation</dt>
                        <dd>{application.occupation || '—'}</dd>
                      </div>
                      <div>
                        <dt>Annual income</dt>
                        <dd>
                          {application.annualIncome ? incomeBandLabel(application.annualIncome) : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Opening deposit</dt>
                        <dd>{formatMinor(application.initialDepositMinor || 0)}</dd>
                      </div>
                    </dl>

                    {application.documents && (
                      <div
                        style={{
                          marginTop: 14,
                          paddingTop: 12,
                          borderTop: '1px solid var(--line, #e2e8f0)',
                        }}
                      >
                        <h4
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: 'var(--muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            marginBottom: 8,
                          }}
                        >
                          Submitted KYC Documents
                        </h4>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                            gap: 10,
                          }}
                        >
                          {[
                            { key: 'panCard', label: 'PAN Card' },
                            { key: 'aadhaarCard', label: 'Identity / OVD' },
                            { key: 'photograph', label: 'Photograph' },
                            { key: 'signature', label: 'Signature' },
                          ].map(({ key, label }) => {
                            const src = application.documents[key]
                            return (
                              <div
                                key={key}
                                style={{
                                  border: '1px solid var(--line, #e2e8f0)',
                                  borderRadius: 8,
                                  padding: 8,
                                  background: src ? '#f8fafc' : '#fff',
                                  textAlign: 'center',
                                }}
                              >
                                {src ? (
                                  <>
                                    <img
                                      src={src}
                                      alt={label}
                                      style={{
                                        width: '100%',
                                        height: 70,
                                        objectFit: 'contain',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        background: '#fff',
                                        border: '1px solid #e2e8f0',
                                      }}
                                      onClick={() =>
                                        setDocModal({
                                          open: true,
                                          title: `${application.applicationNumber} · ${label}`,
                                          src,
                                        })
                                      }
                                      title="Click to inspect full document"
                                    />
                                    <div
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: 'var(--ink)',
                                        marginTop: 4,
                                      }}
                                    >
                                      {label}
                                    </div>
                                    <button
                                      type="button"
                                      style={{
                                        border: 'none',
                                        background: 'none',
                                        color: 'var(--indigo, #4f46e5)',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        padding: 0,
                                        marginTop: 2,
                                      }}
                                      onClick={() =>
                                        setDocModal({
                                          open: true,
                                          title: `${application.applicationNumber} · ${label}`,
                                          src,
                                        })
                                      }
                                    >
                                      Inspect ↗
                                    </button>
                                  </>
                                ) : (
                                  <div
                                    style={{
                                      padding: '16px 0',
                                      fontSize: 11,
                                      color: 'var(--muted)',
                                    }}
                                  >
                                    <div>{label}</div>
                                    <span style={{ fontSize: 10, color: '#94a3b8' }}>
                                      Not provided
                                    </span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {rejectingId === application._id ? (
                      <div className="db-form" style={{ marginTop: 12 }}>
                        <div className="field">
                          <label htmlFor={`remarks-${application._id}`}>
                            Rejection remarks (shown to customer)
                          </label>
                          <textarea
                            id={`remarks-${application._id}`}
                            className="input"
                            rows={3}
                            maxLength={280}
                            value={remarks}
                            onChange={(event) => setRemarks(event.target.value)}
                          />
                        </div>
                        <div className="db-form__actions">
                          <button
                            type="button"
                            className="db-btn db-btn--primary"
                            onClick={() => handleReject(application)}
                            disabled={actingId === application._id}
                          >
                            {actingId === application._id ? 'Rejecting…' : 'Confirm rejection'}
                          </button>
                          <button
                            type="button"
                            className="db-btn db-btn--outline"
                            onClick={() => {
                              setRejectingId('')
                              setRemarks('')
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="db-form__actions" style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className="db-btn db-btn--primary"
                          onClick={() => handleApprove(application)}
                          disabled={actingId === application._id}
                        >
                          {actingId === application._id ? 'Approving…' : 'Approve & Open Account'}
                        </button>
                        <button
                          type="button"
                          className="db-btn db-btn--outline"
                          onClick={() => {
                            setRejectingId(application._id)
                            setRemarks('')
                          }}
                          disabled={actingId === application._id}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </section>
          )}

          {/* Tab 3: Flagged Transfers */}
          {activeTab === 'flagged' && (
            <section className="db-card" style={{ marginTop: 20 }}>
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Flagged Transfers Review</h2>
                  <p className="db-card__sub">
                    Large or suspicious transfers flagged for staff compliance oversight.
                  </p>
                </div>
                <div>
                  <select
                    className="input db-select"
                    value={flaggedFilter}
                    onChange={(e) => setFlaggedFilter(e.target.value)}
                  >
                    <option value="pending">Pending Review</option>
                    <option value="cleared">Cleared</option>
                    <option value="escalated">Escalated</option>
                  </select>
                </div>
              </div>

              {loadingFlagged ? (
                <div className="db-loading">Loading flagged transfers…</div>
              ) : flaggedList.length === 0 ? (
                <div className="db-empty">
                  <div className="db-empty__title">No flagged transfers</div>
                  <p className="db-empty__text">No transfers currently match the review status.</p>
                </div>
              ) : (
                <div className="db-table-wrap">
                  <table className="db-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>User</th>
                        <th>Amount</th>
                        <th>Flag Reason</th>
                        <th>Review Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flaggedList.map((tx) => (
                        <tr key={tx._id}>
                          <td>{formatDateTime(tx.createdAt)}</td>
                          <td>
                            <div className="db-table__title">{tx.user?.name || '—'}</div>
                            <div className="db-table__sub">{tx.user?.email || '—'}</div>
                          </td>
                          <td className="num is-out">−{formatMinor(Math.abs(tx.amount))}</td>
                          <td>{tx.flagReason || 'Large transfer threshold exceeded'}</td>
                          <td>
                            <span className={`pill pill--${tx.reviewStatus || 'pending'}`}>
                              {tx.reviewStatus || 'pending'}
                            </span>
                          </td>
                          <td>
                            {tx.reviewStatus === 'pending' ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className="db-btn db-btn--primary"
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                  onClick={() => handleReviewFlagged(tx._id, 'cleared')}
                                  disabled={reviewingTxId === tx._id}
                                >
                                  Clear
                                </button>
                                <button
                                  type="button"
                                  className="db-btn db-btn--outline"
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                  onClick={() => handleReviewFlagged(tx._id, 'escalated')}
                                  disabled={reviewingTxId === tx._id}
                                >
                                  Escalate
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                                Reviewed by {tx.reviewedBy?.name || 'Staff'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Modal: Open Account for Customer */}
      {openModalOpen && (
        <div className="cookie-modal-backdrop" role="dialog" aria-modal="true">
          <div className="cookie-modal" style={{ maxWidth: 480 }}>
            <div className="cookie-modal__head">
              <div>
                <h3 className="cookie-modal__title">Open Customer Account</h3>
                <p className="cookie-modal__sub">
                  Create a new bank account on behalf of a registered customer.
                </p>
              </div>
              <button
                type="button"
                className="cookie-modal__close"
                onClick={() => setOpenModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleOpenForCustomer} className="db-form">
              {openModalError && (
                <div className="db-alert db-alert--error" role="alert">
                  {openModalError}
                </div>
              )}

              <div className="field">
                <label htmlFor="customer-email">Customer Email</label>
                <input
                  id="customer-email"
                  type="email"
                  className="input"
                  required
                  placeholder="customer@example.com"
                  value={newAccountForm.customerEmail}
                  onChange={(e) =>
                    setNewAccountForm({ ...newAccountForm, customerEmail: e.target.value })
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="customer-acct-type">Account Type</label>
                <select
                  id="customer-acct-type"
                  className="input db-select"
                  value={newAccountForm.type}
                  onChange={(e) =>
                    setNewAccountForm({ ...newAccountForm, type: e.target.value })
                  }
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ACCOUNT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="customer-nickname">Account Nickname (Optional)</label>
                <input
                  id="customer-nickname"
                  className="input"
                  placeholder="e.g. Salary Account"
                  value={newAccountForm.nickname}
                  onChange={(e) =>
                    setNewAccountForm({ ...newAccountForm, nickname: e.target.value })
                  }
                />
              </div>

              <div className="db-form__actions" style={{ marginTop: 20 }}>
                <button
                  type="submit"
                  className="db-btn db-btn--primary"
                  disabled={creatingAccount}
                >
                  {creatingAccount ? 'Opening…' : 'Open Account'}
                </button>
                <button
                  type="button"
                  className="db-btn db-btn--outline"
                  onClick={() => setOpenModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Counter Deposit / Withdrawal */}
      {moneyModal.open && moneyModal.account && (
        <div className="cookie-modal-backdrop" role="dialog" aria-modal="true">
          <div className="cookie-modal" style={{ maxWidth: 480 }}>
            <div className="cookie-modal__head">
              <div>
                <h3 className="cookie-modal__title" style={{ textTransform: 'capitalize' }}>
                  Counter {moneyModal.kind}
                </h3>
                <p className="cookie-modal__sub">
                  Account {maskAccount(moneyModal.account.accountNumber)} ({moneyModal.account.user?.name}) ·
                  Balance: {formatMinor(moneyModal.account.balance)}
                </p>
              </div>
              <button
                type="button"
                className="cookie-modal__close"
                onClick={() => setMoneyModal({ ...moneyModal, open: false })}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleMoneySubmit} className="db-form">
              {moneyModal.error && (
                <div className="db-alert db-alert--error" role="alert">
                  {moneyModal.error}
                </div>
              )}

              <div className="field">
                <label htmlFor="counter-amount">Amount (₹)</label>
                <input
                  id="counter-amount"
                  className="input"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={moneyModal.amount}
                  onChange={(e) =>
                    setMoneyModal((curr) => ({ ...curr, amount: e.target.value }))
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="counter-desc">Reason / Slip Reference</label>
                <input
                  id="counter-desc"
                  className="input"
                  placeholder="Branch deposit slip, teller cash payout…"
                  value={moneyModal.description}
                  onChange={(e) =>
                    setMoneyModal((curr) => ({ ...curr, description: e.target.value }))
                  }
                />
              </div>

              <div className="db-form__actions" style={{ marginTop: 20 }}>
                <button
                  type="submit"
                  className="db-btn db-btn--primary"
                  disabled={moneyModal.busy}
                >
                  {moneyModal.busy ? 'Processing…' : `Confirm ${moneyModal.kind}`}
                </button>
                <button
                  type="button"
                  className="db-btn db-btn--outline"
                  onClick={() => setMoneyModal({ ...moneyModal, open: false })}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KYC Document Lightbox Modal */}
      {docModal.open && (
        <div
          className="kyc-modal-overlay"
          onClick={() => setDocModal({ open: false, title: '', src: '' })}
        >
          <div className="kyc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="kyc-modal-head">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{docModal.title}</h3>
              <button
                type="button"
                className="db-btn db-btn--outline"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => setDocModal({ open: false, title: '', src: '' })}
              >
                Close ✕
              </button>
            </div>
            <div className="kyc-modal-body">
              <img src={docModal.src} alt={docModal.title} className="kyc-modal-img" />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
