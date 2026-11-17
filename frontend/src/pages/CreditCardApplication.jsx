import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import CardVisual from '../components/CardVisual'
import {
  createCreditApplication,
  listAccounts,
  listCreditCards,
  listMyCreditApplications,
} from '../services/api'
import { formatRupees } from '../utils/money'
import { APPLICATION_STATUS_LABELS, formatDate } from '../utils/format'

const MIN_LIMIT_MINOR = 500_000 // ₹5,000
const MAX_LIMIT_MINOR = 50_000_000 // ₹5,00,000
const MAX_CARDS = 3
const LIMIT_OPTIONS = [
  500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 20_000_000, 30_000_000, 50_000_000,
]

export default function CreditCardApplication() {
  const [applications, setApplications] = useState([])
  const [cardCount, setCardCount] = useState(0)
  const [hasAccount, setHasAccount] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [limit, setLimit] = useState(5_000_000)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([listMyCreditApplications(), listCreditCards(), listAccounts()])
      .then(([applicationData, cardData, accountData]) => {
        if (!active) return
        setApplications(applicationData.applications)
        setCardCount(cardData.cards.length)
        setHasAccount(accountData.accounts.some((account) => account.status === 'active'))
        setLoadError('')
      })
      .catch((err) => {
        if (active) setLoadError(err.response?.data?.message || 'Could not load your applications.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const pending = applications.find((application) => application.status === 'pending')
  const atCardLimit = cardCount >= MAX_CARDS
  const blocked = Boolean(pending) || atCardLimit || !hasAccount

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!confirmed) {
      setError('Please confirm that your application details are accurate.')
      return
    }
    setSubmitting(true)
    try {
      const data = await createCreditApplication({ requestedLimitMinor: limit })
      setNotice(`${data.message} Reference: ${data.application.applicationNumber}`)
      setConfirmed(false)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit your application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Personal banking"
        title="Credit Card Application"
        sub="Choose the credit limit you would like the bank to review. Every application is checked by bank staff."
        actions={
          <Link to="/cards/credit" className="db-btn db-btn--outline">
            My credit cards
          </Link>
        }
      />

      {loading && <div className="db-loading">Loading…</div>}

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

      {!loading && !loadError && (
        <>
          {notice && (
            <div className="db-alert db-alert--success" role="status">
              {notice}
            </div>
          )}
          {pending && (
            <div className="db-alert db-alert--info" role="status">
              Application {pending.applicationNumber} for a {formatRupees(pending.requestedLimit)} limit is
              pending review. You can apply again once it has been decided.
            </div>
          )}
          {!pending && atCardLimit && (
            <div className="db-alert db-alert--info" role="status">
              You already hold the maximum of {MAX_CARDS} credit cards.
            </div>
          )}
          {!hasAccount && (
            <div className="db-alert db-alert--info" role="status">
              You need an active bank account before you can apply for a credit card.{' '}
              <Link to="/accounts" style={{ fontWeight: 600 }}>
                Go to my accounts
              </Link>
            </div>
          )}

          <div className="cc-apply">
            <div>
              <CardVisual kind="credit" label="Your requested limit" value={formatRupees(limit)} />
              <p className="cc-apply__preview-note">Illustrative preview — this is not an issued card.</p>
            </div>

            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Application details</h2>
                  <p className="db-card__sub">Enter the credit limit you would like the bank to review.</p>
                </div>
              </div>

              <form className="db-form" onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="cc-limit">Requested credit limit (₹)</label>
                  <select
                    id="cc-limit"
                    className="input db-select"
                    value={limit}
                    onChange={(event) => setLimit(Number(event.target.value))}
                    disabled={blocked}
                  >
                    {LIMIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatRupees(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cc-limit-box">
                  <div>
                    <span>Minimum limit</span>
                    <span>{formatRupees(MIN_LIMIT_MINOR)}</span>
                  </div>
                  <div>
                    <span>Maximum limit</span>
                    <span>{formatRupees(MAX_LIMIT_MINOR)}</span>
                  </div>
                </div>

                <label className="check">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    disabled={blocked}
                  />
                  <span>
                    I confirm that my application details are accurate and understand that this application
                    requires bank review and approval.
                  </span>
                </label>

                {error && (
                  <div className="db-alert db-alert--error" role="alert">
                    {error}
                  </div>
                )}

                <div className="db-form__actions">
                  <button type="submit" className="db-btn db-btn--primary" disabled={submitting || blocked}>
                    {submitting ? 'Submitting…' : 'Submit application'}
                  </button>
                </div>
                <p className="db-note" style={{ marginTop: 0 }}>
                  Your application is associated with your authenticated Northbank account. The approved limit
                  may differ from the one you request.
                </p>
              </form>
            </section>
          </div>

          {applications.length > 0 && (
            <section className="db-card" style={{ marginTop: 20 }}>
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Your applications</h2>
                  <p className="db-card__sub">Track the status of every credit card application.</p>
                </div>
              </div>
              <div className="db-table-wrap">
                <table className="db-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Submitted</th>
                      <th className="num">Requested limit</th>
                      <th className="num">Approved limit</th>
                      <th>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application._id}>
                        <td>{application.applicationNumber}</td>
                        <td>{formatDate(application.createdAt)}</td>
                        <td className="num">{formatRupees(application.requestedLimit)}</td>
                        <td className="num">
                          {application.approvedLimit ? formatRupees(application.approvedLimit) : '—'}
                        </td>
                        <td>
                          <span className={`pill pill--${application.status}`}>
                            {APPLICATION_STATUS_LABELS[application.status] || application.status}
                          </span>
                        </td>
                        <td>
                          {application.remarks || (application.status === 'pending' ? 'Under review' : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  )
}
