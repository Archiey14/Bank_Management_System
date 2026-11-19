import { useEffect, useState } from 'react'
import AppShell, { PageHeader } from '../components/AppShell'
import Modal from '../components/Modal'
import {
  approveCreditApplication,
  approveDebitApplication,
  listBlockedCards,
  listCreditApplications,
  listDebitApplications,
  rejectCreditApplication,
  rejectDebitApplication,
  setStaffCardStatus,
} from '../services/api'
import { formatRupees, toMinorUnits } from '../utils/money'
import {
  APPLICATION_STATUS_LABELS,
  ACCOUNT_TYPE_LABELS,
  formatDate,
  formatDateTime,
  last4,
} from '../utils/format'

const STATUS_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]

export default function StaffCards() {
  const [view, setView] = useState('debit_apps') // 'debit_apps' | 'credit_apps' | 'blocked'
  const [status, setStatus] = useState('pending')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [applications, setApplications] = useState([])
  const [blocked, setBlocked] = useState({ debitCards: [], creditCards: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState('')

  const [review, setReview] = useState(null) // { kind: 'approve' | 'reject', application, type: 'debit' | 'credit' }
  const [limitInput, setLimitInput] = useState('')
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    let active = true
    let request

    if (view === 'debit_apps') {
      request = listDebitApplications({ status, q: query }).then((data) => {
        if (active) setApplications(data.applications || [])
      })
    } else if (view === 'credit_apps') {
      request = listCreditApplications({ status, q: query }).then((data) => {
        if (active) setApplications(data.applications || [])
      })
    } else {
      request = listBlockedCards().then((data) => {
        if (active) setBlocked({ debitCards: data.debitCards, creditCards: data.creditCards })
      })
    }

    request
      .then(() => {
        if (active) setLoadError('')
      })
      .catch((err) => {
        if (active) setLoadError(err.response?.data?.message || 'Could not load this list.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [view, status, query, reloadKey])

  const refresh = () => setReloadKey((key) => key + 1)

  const switchView = (next) => {
    if (next === view) return
    setLoading(true)
    setNotice('')
    setView(next)
  }

  const openReview = (kind, application, type) => {
    setReview({ kind, application, type })
    setReviewError('')
    setRemarks('')
    if (type === 'credit') {
      setLimitInput(String((application.requestedLimit || 0) / 100))
    }
  }

  const submitReview = async (event) => {
    event.preventDefault()
    setReviewError('')
    setBusy(true)
    try {
      if (review.type === 'debit') {
        if (review.kind === 'approve') {
          const res = await approveDebitApplication(review.application._id)
          setNotice(
            `Approved ${review.application.applicationNumber} — card issued and approval email with generated PIN (${res.generatedPin || 'sent'}) delivered to ${review.application.user?.email || 'customer'}.`
          )
        } else {
          if (remarks.trim().length < 3) {
            setReviewError('Add remarks so the customer knows why (at least 3 characters).')
            setBusy(false)
            return
          }
          await rejectDebitApplication(review.application._id, remarks.trim())
          setNotice(`Rejected ${review.application.applicationNumber}.`)
        }
      } else {
        // Credit card application review
        if (review.kind === 'approve') {
          const minor = toMinorUnits(limitInput)
          if (!minor) {
            setReviewError('Enter the credit limit to approve.')
            setBusy(false)
            return
          }
          const res = await approveCreditApplication(review.application._id, minor)
          setNotice(
            `Approved ${review.application.applicationNumber} — credit card issued with PIN (${res.generatedPin || 'sent'}) and approval email delivered to ${review.application.user?.email || 'customer'}.`
          )
        } else {
          if (remarks.trim().length < 3) {
            setReviewError('Add remarks so the customer knows why (at least 3 characters).')
            setBusy(false)
            return
          }
          await rejectCreditApplication(review.application._id, remarks.trim())
          setNotice(`Rejected ${review.application.applicationNumber}.`)
        }
      }
      setReview(null)
      refresh()
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Could not complete the review.')
    } finally {
      setBusy(false)
    }
  }

  const release = async (kind, card) => {
    if (!window.confirm(`Release the ${kind} card ending ${card.last4}?`)) return
    setNotice('')
    try {
      await setStaffCardStatus(kind, card._id, 'active')
      setNotice(`Released the card ending ${card.last4}.`)
      refresh()
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not release the card.')
    }
  }

  const blockedCount = blocked.debitCards.length + blocked.creditCards.length

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operations"
        title="Card Desk"
        sub="Review debit & credit card applications, issue cards with hexadecimal PINs, and release blocked cards."
      />

      <div className="seg-tabs" role="tablist" aria-label="Card desk sections">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'debit_apps'}
          className={view === 'debit_apps' ? 'is-active' : ''}
          onClick={() => switchView('debit_apps')}
        >
          Debit card applications
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'credit_apps'}
          className={view === 'credit_apps' ? 'is-active' : ''}
          onClick={() => switchView('credit_apps')}
        >
          Credit card applications
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'blocked'}
          className={view === 'blocked' ? 'is-active' : ''}
          onClick={() => switchView('blocked')}
        >
          Blocked cards{view === 'blocked' ? ` (${blockedCount})` : ''}
        </button>
      </div>

      {notice && (
        <div className="db-alert db-alert--success" role="status">
          {notice}
        </div>
      )}
      {loadError && (
        <div className="db-alert db-alert--error" role="alert">
          {loadError}
        </div>
      )}

      {(view === 'debit_apps' || view === 'credit_apps') && (
        <section className="db-card" style={{ marginTop: 20 }}>
          <div className="db-card__head">
            <div>
              <h2 className="db-card__title">
                {view === 'debit_apps' ? 'Debit Card Applications' : 'Credit Card Applications'}
              </h2>
              <p className="db-card__sub">
                Approving an application automatically generates a hexadecimal PIN, issues the card, and emails the
                customer.
              </p>
            </div>
          </div>

          <div className="cc-picker">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                className={status === tab.value ? 'is-active' : ''}
                onClick={() => {
                  setLoading(true)
                  setStatus(tab.value)
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form
            className="db-form__actions"
            style={{ marginTop: 14 }}
            onSubmit={(event) => {
              event.preventDefault()
              setLoading(true)
              setQuery(search.trim())
            }}
          >
            <input
              className="input"
              style={{ maxWidth: 320, height: 40 }}
              placeholder="Search by name, email or reference"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search applications"
            />
            <button type="submit" className="db-btn db-btn--outline" style={{ height: 40 }}>
              Search
            </button>
          </form>

          {loading ? (
            <div className="db-loading">Loading applications…</div>
          ) : applications.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty__title">No applications found</div>
              <p className="db-empty__text">Nothing matches the current filter or search criteria.</p>
            </div>
          ) : (
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Customer</th>
                    <th>Submitted</th>
                    {view === 'debit_apps' ? (
                      <th>Linked Account</th>
                    ) : (
                      <>
                        <th className="num">Requested Limit</th>
                        <th className="num">Approved Limit</th>
                      </>
                    )}
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr key={application._id}>
                      <td>
                        <strong>{application.applicationNumber}</strong>
                      </td>
                      <td>
                        <div className="db-table__title">{application.user?.name || 'Unknown'}</div>
                        <div className="db-table__sub">{application.user?.email}</div>
                      </td>
                      <td>{formatDate(application.createdAt)}</td>
                      {view === 'debit_apps' ? (
                        <td>
                          {application.account
                            ? `${ACCOUNT_TYPE_LABELS[application.account.type] || application.account.type} •••• ${last4(application.account.accountNumber)}`
                            : '—'}
                        </td>
                      ) : (
                        <>
                          <td className="num">{formatRupees(application.requestedLimit)}</td>
                          <td className="num">
                            {application.approvedLimit ? formatRupees(application.approvedLimit) : '—'}
                          </td>
                        </>
                      )}
                      <td>
                        <span className={`pill pill--${application.status}`}>
                          {APPLICATION_STATUS_LABELS[application.status] || application.status}
                        </span>
                        {application.remarks && <div className="db-table__sub">{application.remarks}</div>}
                      </td>
                      <td className="num">
                        {application.status === 'pending' && (
                          <div className="card-tile__actions" style={{ justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="db-btn db-btn--primary"
                              onClick={() =>
                                openReview('approve', application, view === 'debit_apps' ? 'debit' : 'credit')
                              }
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="db-btn db-btn--outline"
                              onClick={() =>
                                openReview('reject', application, view === 'debit_apps' ? 'debit' : 'credit')
                              }
                            >
                              Reject
                            </button>
                          </div>
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

      {view === 'blocked' && (
        <section className="db-card" style={{ marginTop: 20 }}>
          <div className="db-card__head">
            <div>
              <h2 className="db-card__title">Blocked cards</h2>
              <p className="db-card__sub">
                Customers can block a card themselves; only staff can release it. A debit card that was never activated
                returns to “inactive” so the customer still sets a PIN.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="db-loading">Loading blocked cards…</div>
          ) : blockedCount === 0 ? (
            <div className="db-empty">
              <div className="db-empty__title">No blocked cards</div>
              <p className="db-empty__text">Every card is currently usable.</p>
            </div>
          ) : (
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Customer</th>
                    <th>Linked to</th>
                    <th>Blocked on</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {blocked.debitCards.map((card) => (
                    <tr key={card._id}>
                      <td>Debit •••• {card.last4}</td>
                      <td>
                        <div className="db-table__title">{card.user?.name || 'Unknown'}</div>
                        <div className="db-table__sub">{card.user?.email}</div>
                      </td>
                      <td>
                        {card.account
                          ? `${ACCOUNT_TYPE_LABELS[card.account.type] || card.account.type} •••• ${last4(card.account.accountNumber)}`
                          : '—'}
                      </td>
                      <td>{formatDateTime(card.blockedAt)}</td>
                      <td className="num">
                        <button type="button" className="db-btn db-btn--outline" onClick={() => release('debit', card)}>
                          Release
                        </button>
                      </td>
                    </tr>
                  ))}
                  {blocked.creditCards.map((card) => (
                    <tr key={card._id}>
                      <td>Credit •••• {card.last4}</td>
                      <td>
                        <div className="db-table__title">{card.user?.name || 'Unknown'}</div>
                        <div className="db-table__sub">{card.user?.email}</div>
                      </td>
                      <td>Limit {formatRupees(card.creditLimit)}</td>
                      <td>{formatDateTime(card.blockedAt)}</td>
                      <td className="num">
                        <button type="button" className="db-btn db-btn--outline" onClick={() => release('credit', card)}>
                          Release
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {review && (
        <Modal
          title={
            review.kind === 'approve'
              ? `Approve ${review.type === 'debit' ? 'Debit' : 'Credit'} Card Application`
              : `Reject ${review.type === 'debit' ? 'Debit' : 'Credit'} Card Application`
          }
          sub={`${review.application.applicationNumber} · Customer: ${review.application.user?.name || 'Customer'} (${review.application.user?.email || ''})`}
          onClose={() => {
            if (!busy) setReview(null)
          }}
          busy={busy}
        >
          <form className="db-form" onSubmit={submitReview} style={{ marginTop: 0 }}>
            {review.kind === 'approve' ? (
              review.type === 'credit' ? (
                <div className="field">
                  <label htmlFor="review-limit">Approved credit limit (₹)</label>
                  <input
                    id="review-limit"
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={limitInput}
                    onChange={(event) => setLimitInput(event.target.value)}
                    autoFocus
                  />
                  <div className="field-hint">
                    Between ₹5,000 and ₹5,00,000. An automated approval email with a generated hexadecimal PIN will be sent to the customer.
                  </div>
                </div>
              ) : (
                <div className="field">
                  <p className="db-note" style={{ marginTop: 0 }}>
                    Approving will immediately issue and activate this debit card linked to account ending in ••••{' '}
                    {last4(review.application.account?.accountNumber || '')}. A random 4-character hexadecimal PIN
                    will be generated and dispatched to <strong>{review.application.user?.email}</strong> via email.
                  </p>
                </div>
              )
            ) : (
              <div className="field">
                <label htmlFor="review-remarks">Remarks for the customer</label>
                <textarea
                  id="review-remarks"
                  className="input db-textarea"
                  maxLength={280}
                  placeholder="State the reason for rejecting this application..."
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  autoFocus
                />
              </div>
            )}
            {reviewError && (
              <div className="db-alert db-alert--error" role="alert">
                {reviewError}
              </div>
            )}
            <div className="db-form__actions">
              <button type="submit" className="db-btn db-btn--primary" disabled={busy}>
                {busy ? 'Processing…' : review.kind === 'approve' ? 'Approve & Issue with PIN' : 'Reject Application'}
              </button>
              <button
                type="button"
                className="db-btn db-btn--outline"
                onClick={() => setReview(null)}
                disabled={busy}
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
