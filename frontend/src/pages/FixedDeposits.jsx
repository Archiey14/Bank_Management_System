import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import { ArrowRightIcon } from '../components/appIcons'
import {
  bookFixedDeposit,
  listAccounts,
  listFixedDeposits,
  newIdempotencyKey,
  settleFixedDeposit,
} from '../services/api'
import { formatMinor, toMinorUnits } from '../utils/money'
import { ACCOUNT_TYPE_LABELS, formatDate, maskAccount } from '../utils/format'

const FD_RATES = { 6: 5.5, 12: 6.5, 24: 7.0, 36: 7.5 }
const FD_MIN_AMOUNT_MINOR = 1_000_000

const nextSourceId = (list, currentId) => {
  if (currentId && list.some((account) => account._id === currentId)) return currentId
  return list[0]?._id || ''
}

const progressPercent = (fd) => {
  const start = new Date(fd.openedAt).getTime()
  const end = new Date(fd.maturityDate).getTime()
  if (end <= start) return 100
  const percent = ((Date.now() - start) / (end - start)) * 100
  return Math.min(100, Math.max(0, Math.round(percent)))
}

export default function FixedDeposits() {
  const [accounts, setAccounts] = useState([])
  const [deposits, setDeposits] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')

  const [form, setForm] = useState({ sourceAccountId: '', principal: '', tenureMonths: '12' })
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState('')
  const bookingKey = useRef(newIdempotencyKey())

  const [settlingId, setSettlingId] = useState('')

  const load = async (showSpinner = false) => {
    if (showSpinner) {
      setLoading(true)
      setLoadError('')
    }
    try {
      const [accountsData, depositsData] = await Promise.all([listAccounts(), listFixedDeposits()])
      const active = accountsData.accounts.filter((account) => account.status === 'active')
      setAccounts(active)
      setDeposits(depositsData.fixedDeposits)
      setForm((current) => ({ ...current, sourceAccountId: nextSourceId(active, current.sourceAccountId) }))
      setLoadError('')
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load your fixed deposits.')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([listAccounts(), listFixedDeposits()])
      .then(([accountsData, depositsData]) => {
        if (!active) return
        const activeAccounts = accountsData.accounts.filter((account) => account.status === 'active')
        setAccounts(activeAccounts)
        setDeposits(depositsData.fixedDeposits)
        setForm((current) => ({
          ...current,
          sourceAccountId: nextSourceId(activeAccounts, current.sourceAccountId),
        }))
      })
      .catch((err) => {
        if (active) setLoadError(err.response?.data?.message || 'Could not load your fixed deposits.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const tenureMonths = Number(form.tenureMonths)
  const rate = FD_RATES[tenureMonths]
  const principalMinor = toMinorUnits(form.principal)
  const previewInterest =
    principalMinor && rate ? Math.round(principalMinor * (rate / 100) * (tenureMonths / 12)) : 0
  const previewMaturity = principalMinor ? principalMinor + previewInterest : 0

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const handleBook = async (event) => {
    event.preventDefault()
    setBookError('')
    setNotice('')

    if (!form.sourceAccountId) {
      setBookError('Choose the account to take the deposit from.')
      return
    }
    if (!principalMinor || principalMinor < FD_MIN_AMOUNT_MINOR) {
      setBookError('Fixed deposits start at ₹10,000.')
      return
    }

    setBooking(true)
    try {
      const data = await bookFixedDeposit({
        sourceAccountId: form.sourceAccountId,
        principalMinor,
        tenureMonths,
        idempotencyKey: bookingKey.current,
      })
      bookingKey.current = newIdempotencyKey()
      setForm((current) => ({ ...current, principal: '' }))
      setNotice(
        data.replayed
          ? 'That deposit was already booked — it was not applied twice.'
          : `Booked ${formatMinor(principalMinor)} for ${tenureMonths} months at ${rate}% p.a.`
      )
      await load(false)
    } catch (err) {
      setBookError(err.response?.data?.message || 'Could not book the fixed deposit.')
      if (err.response) bookingKey.current = newIdempotencyKey()
    } finally {
      setBooking(false)
    }
  }

  const handleSettle = async (fd) => {
    const matured = fd.preview?.matured
    const label = matured
      ? `Settle this deposit for ${formatMinor(fd.preview.settlementMinor)}?`
      : `Break this deposit early? You receive ${formatMinor(fd.preview.settlementMinor)} after the 1% penalty.`
    if (!window.confirm(label)) return

    setSettlingId(fd._id)
    setNotice('')
    setBookError('')
    try {
      const data = await settleFixedDeposit(fd._id)
      setNotice(`${data.message}. ${formatMinor(data.fixedDeposit.settlementAmountMinor)} credited.`)
      await load(false)
    } catch (err) {
      setBookError(err.response?.data?.message || 'Could not settle the fixed deposit.')
    } finally {
      setSettlingId('')
    }
  }

  const activeDeposits = deposits.filter((fd) => fd.status === 'active')
  const settledDeposits = deposits.filter((fd) => fd.status === 'settled')

  const renderCard = (fd) => (
    <article className="fd-card" key={fd._id}>
      <div className="fd-card__label">
        {fd.status === 'active' ? (fd.preview?.matured ? 'Matured' : 'Running') : 'Settled'}
      </div>
      <div className="fd-card__amount">
        {formatMinor(fd.status === 'settled' ? fd.settlementAmountMinor : fd.maturityAmountMinor)}
      </div>
      <div className="fd-card__meta">
        {fd.principalMinor ? `${formatMinor(fd.principalMinor)} principal · ` : ''}
        {fd.ratePercent}% p.a. · {fd.tenureMonths} months
      </div>
      <div className="fd-card__meta">
        Matures {formatDate(fd.maturityDate)}
        {fd.status === 'settled' && fd.settledAt ? ` · settled ${formatDate(fd.settledAt)}` : ''}
      </div>

      {fd.status === 'active' && (
        <>
          <div className="fd-progress" aria-hidden="true">
            <div className="fd-progress__bar" style={{ width: `${progressPercent(fd)}%` }} />
          </div>
          <div className="fd-card__meta">
            {fd.preview?.matured
              ? 'Maturity reached — settle any time for the full amount.'
              : `Break now: ${formatMinor(fd.preview?.settlementMinor ?? 0)} (includes ${formatMinor(
                  fd.preview?.penaltyMinor ?? 0
                )} penalty)`}
          </div>
          <div className="fd-card__actions">
            <button
              type="button"
              className="db-btn db-btn--outline"
              onClick={() => handleSettle(fd)}
              disabled={settlingId === fd._id}
            >
              {settlingId === fd._id
                ? 'Settling…'
                : fd.preview?.matured
                  ? 'Settle deposit'
                  : 'Break & settle'}
            </button>
          </div>
        </>
      )}
    </article>
  )

  return (
    <AppShell>
      <PageHeader
        eyebrow="Grow your money"
        title="Fixed deposits"
        sub="Lock in a rate for 6 to 36 months. Interest is simple and paid out at maturity."
        actions={
          <Link to="/accounts" className="db-btn db-btn--outline">
            Back to accounts
          </Link>
        }
      />

      {notice && (
        <div className="db-alert db-alert--success" role="status">
          {notice}
        </div>
      )}

      {loading && <div className="db-loading">Loading your fixed deposits…</div>}

      {!loading && loadError && (
        <>
          <div className="db-alert db-alert--error" role="alert">
            {loadError}
          </div>
          <div className="db-form__actions" style={{ marginTop: 16 }}>
            <button type="button" className="db-btn db-btn--outline" onClick={() => load(true)}>
              Try again
            </button>
          </div>
        </>
      )}

      {!loading && !loadError && (
        <>
          <div className="db-page-grid">
            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Book a fixed deposit</h2>
                  <p className="db-card__sub">
                    The principal moves out of your account until it settles.
                  </p>
                </div>
              </div>

              {accounts.length === 0 ? (
                <div className="db-empty">
                  <div className="db-empty__title">No active accounts</div>
                  <p className="db-empty__text">Open an account first, then book a deposit.</p>
                  <Link to="/accounts" className="db-btn db-btn--primary">
                    Open an account
                  </Link>
                </div>
              ) : (
                <form className="db-form" onSubmit={handleBook}>
                  <div className="field">
                    <label htmlFor="fd-source">From account</label>
                    <select
                      id="fd-source"
                      className="input db-select"
                      value={form.sourceAccountId}
                      onChange={update('sourceAccountId')}
                    >
                      {accounts.map((account) => (
                        <option key={account._id} value={account._id}>
                          {ACCOUNT_TYPE_LABELS[account.type]} {maskAccount(account.accountNumber)} ·{' '}
                          {formatMinor(account.balance)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="fd-amount">Deposit amount (₹)</label>
                    <input
                      id="fd-amount"
                      className="input"
                      type="text"
                      inputMode="decimal"
                      placeholder="10,000 minimum"
                      value={form.principal}
                      onChange={update('principal')}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="fd-tenure">Tenure</label>
                    <select
                      id="fd-tenure"
                      className="input db-select"
                      value={form.tenureMonths}
                      onChange={update('tenureMonths')}
                    >
                      {Object.entries(FD_RATES).map(([months, tenureRate]) => (
                        <option key={months} value={months}>
                          {months} months · {tenureRate}% p.a.
                        </option>
                      ))}
                    </select>
                  </div>

                  {principalMinor > 0 && (
                    <dl className="db-kv">
                      <div>
                        <dt>Interest at maturity</dt>
                        <dd>{formatMinor(previewInterest)}</dd>
                      </div>
                      <div>
                        <dt>You receive</dt>
                        <dd>{formatMinor(previewMaturity)}</dd>
                      </div>
                      <div>
                        <dt>Rate</dt>
                        <dd>{rate}% p.a. simple</dd>
                      </div>
                    </dl>
                  )}

                  {bookError && (
                    <div className="db-alert db-alert--error" role="alert">
                      {bookError}
                    </div>
                  )}

                  <div className="db-form__actions">
                    <button type="submit" className="db-btn db-btn--primary" disabled={booking}>
                      {booking ? 'Booking…' : 'Book deposit'}
                      {!booking && <ArrowRightIcon />}
                    </button>
                    <span className="db-form__hint">Early breaks pay pro-rata interest minus a 1% penalty.</span>
                  </div>
                </form>
              )}
            </section>

            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">How it works</h2>
                  <p className="db-card__sub">The rules of the term deposit, in short.</p>
                </div>
              </div>
              <ul className="db-checks">
                <li>
                  <span className="db-checks__tick">1</span>
                  <span className="db-checks__label">Principal is debited when you book</span>
                  <span className="db-checks__state">Instant</span>
                </li>
                <li>
                  <span className="db-checks__tick">2</span>
                  <span className="db-checks__label">Interest accrues at a fixed rate</span>
                  <span className="db-checks__state">{rate}% p.a.</span>
                </li>
                <li>
                  <span className="db-checks__tick">3</span>
                  <span className="db-checks__label">Payout lands back in your account</span>
                  <span className="db-checks__state">On settle</span>
                </li>
              </ul>
              <p className="db-note">
                Matured deposits pay the full maturity amount. Breaking early pays interest for the
                days held, minus a 1% penalty on the principal.
              </p>
            </section>
          </div>

          {activeDeposits.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <h2 className="db-card__title" style={{ marginBottom: 12 }}>
                Active deposits ({activeDeposits.length})
              </h2>
              <div className="acct-grid">{activeDeposits.map(renderCard)}</div>
            </section>
          )}

          {settledDeposits.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <h2 className="db-card__title" style={{ marginBottom: 12 }}>
                Settled deposits ({settledDeposits.length})
              </h2>
              <div className="acct-grid">{settledDeposits.map(renderCard)}</div>
            </section>
          )}

          {deposits.length === 0 && (
            <div className="db-empty" style={{ marginTop: 24 }}>
              <div className="db-empty__title">No fixed deposits yet</div>
              <p className="db-empty__text">
                Book your first deposit above and watch it grow toward maturity.
              </p>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
