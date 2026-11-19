import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import CardVisual from '../components/CardVisual'
import Modal from '../components/Modal'
import {
  activateDebitCard,
  applyDebitCard,
  blockDebitCard,
  changeDebitCardPin,
  listAccounts,
  listDebitCards,
  listMyDebitApplications,
  setDebitCardLimit,
} from '../services/api'
import { formatMinor, formatRupees, toMinorUnits } from '../utils/money'
import {
  APPLICATION_STATUS_LABELS,
  ACCOUNT_TYPE_LABELS,
  formatDate,
  formatDateLong,
  formatDateTimeLong,
  formatExpiry,
  last4,
} from '../utils/format'

const ATM_MIN_MINOR = 100_000 // ₹1,000
const ATM_MAX_MINOR = 10_000_000 // ₹1,00,000
const STATUS_FILTERS = [
  { value: '', label: 'All cards' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Awaiting activation' },
  { value: 'blocked', label: 'Blocked' },
]
const STATUS_LABELS = { active: 'Active', inactive: 'Inactive', blocked: 'Blocked' }
const EMPTY_FORM = { accountId: '', pin: '', confirmPin: '', limit: '' }

export default function DebitCards() {
  const [cards, setCards] = useState([])
  const [accounts, setAccounts] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [modal, setModal] = useState(null) // { kind: 'apply' | 'changePin' | 'activate' | 'limit' | 'block', card }
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([listDebitCards(), listAccounts(), listMyDebitApplications()])
      .then(([cardData, accountData, applicationData]) => {
        if (!active) return
        setCards(cardData.cards)
        setAccounts(accountData.accounts)
        setApplications(applicationData.applications || [])
        setLoadError('')
      })
      .catch((err) => {
        if (active) setLoadError(err.response?.data?.message || 'Could not load your cards.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const refresh = () => setReloadKey((key) => key + 1)

  const eligibleAccounts = accounts.filter(
    (account) => account.status === 'active' && account.type !== 'fixed_deposit'
  )
  const visibleCards = cards.filter((card) => !statusFilter || card.status === statusFilter)

  const openModal = (kind, card = null) => {
    setModalError('')
    setForm({
      ...EMPTY_FORM,
      accountId: eligibleAccounts[0]?._id || '',
      limit: card ? String(card.dailyAtmLimit / 100) : '',
    })
    setModal({ kind, card })
  }
  const closeModal = () => {
    if (!busy) setModal(null)
  }
  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const run = async (action, successMessage) => {
    setBusy(true)
    setModalError('')
    try {
      await action()
      setNotice(successMessage)
      setModal(null)
      refresh()
    } catch (err) {
      setModalError(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const submitApply = (event) => {
    event.preventDefault()
    if (!form.accountId) {
      setModalError('Choose the account this card will be linked to.')
      return
    }
    run(
      () => applyDebitCard(form.accountId),
      'Debit card application submitted. Once approved by bank staff, your card will be issued and an approval email with your generated PIN will be sent.'
    )
  }

  const submitChangePin = (event) => {
    event.preventDefault()
    const cleanPin = form.pin.trim().toUpperCase()
    if (!/^[0-9A-F]{4,6}$/.test(cleanPin)) {
      setModalError('PIN must be 4 to 6 characters (digits 0-9 or hexadecimal A-F).')
      return
    }
    if (cleanPin !== form.confirmPin.trim().toUpperCase()) {
      setModalError('The two PINs do not match.')
      return
    }
    run(() => changeDebitCardPin(modal.card._id, cleanPin), 'Debit card PIN updated successfully.')
  }

  const submitActivate = (event) => {
    event.preventDefault()
    const cleanPin = form.pin.trim().toUpperCase()
    if (!/^[0-9A-F]{4,6}$/.test(cleanPin)) {
      setModalError('Your PIN must be 4 to 6 digits or hexadecimal characters.')
      return
    }
    if (cleanPin !== form.confirmPin.trim().toUpperCase()) {
      setModalError('The two PINs do not match.')
      return
    }
    run(() => activateDebitCard(modal.card._id, cleanPin), 'Card activated. You can use it now.')
  }

  const submitLimit = (event) => {
    event.preventDefault()
    const minor = toMinorUnits(form.limit)
    if (!minor || minor < ATM_MIN_MINOR || minor > ATM_MAX_MINOR) {
      setModalError(`Enter a limit between ${formatRupees(ATM_MIN_MINOR)} and ${formatRupees(ATM_MAX_MINOR)}.`)
      return
    }
    run(() => setDebitCardLimit(modal.card._id, minor), 'Daily ATM limit updated.')
  }

  const submitBlock = (event) => {
    event.preventDefault()
    run(() => blockDebitCard(modal.card._id), 'Card blocked. Contact bank support to release it.')
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Personal banking"
        title="Debit Cards"
        sub="Apply for debit cards with admin approval, change your card PIN, adjust daily ATM limits, or block lost cards."
        actions={
          <button
            type="button"
            className="db-btn db-btn--primary"
            onClick={() => openModal('apply')}
            disabled={loading || eligibleAccounts.length === 0}
            title={eligibleAccounts.length === 0 ? 'You need an active savings or current account' : undefined}
          >
            + Apply for debit card
          </button>
        }
      />

      {notice && (
        <div className="db-alert db-alert--success" role="status">
          {notice}
        </div>
      )}

      {loading && <div className="db-loading">Loading your cards…</div>}

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
          {cards.length > 0 && (
            <div className="cc-picker" role="tablist" aria-label="Filter cards by status">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={statusFilter === filter.value ? 'is-active' : ''}
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}

          {cards.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty__title">No debit cards yet</div>
              <p className="db-empty__text">
                {eligibleAccounts.length === 0
                  ? 'Open a savings or current account first, then apply for a debit card.'
                  : 'Apply for a debit card linked to your account. Bank staff will review and approve it, and email your initial PIN.'}
              </p>
              {eligibleAccounts.length === 0 ? (
                <Link to="/accounts" className="db-btn db-btn--primary">
                  Go to my accounts
                </Link>
              ) : (
                <button type="button" className="db-btn db-btn--primary" onClick={() => openModal('apply')}>
                  Apply for a debit card
                </button>
              )}
            </div>
          ) : visibleCards.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty__title">No cards match this filter</div>
            </div>
          ) : (
            <div className="card-grid">
              {visibleCards.map((card) => {
                const account = card.account
                return (
                  <article className="card-tile" key={card._id}>
                    <CardVisual
                      kind="debit"
                      last4={card.last4}
                      expiryMonth={card.expiryMonth}
                      expiryYear={card.expiryYear}
                      status={card.status}
                      label="Daily ATM limit"
                      value={formatRupees(card.dailyAtmLimit)}
                    />

                    <div className="card-tile__head">
                      <div>
                        <div className="card-tile__title">Northbank Debit Card</div>
                        <div className="card-tile__sub">
                          {account
                            ? `${ACCOUNT_TYPE_LABELS[account.type] || account.type} •••• ${last4(account.accountNumber)}`
                            : 'Linked account unavailable'}
                        </div>
                      </div>
                      <span className={`pill pill--${card.status}`}>{STATUS_LABELS[card.status]}</span>
                    </div>

                    <dl className="card-facts">
                      <div>
                        <dt>Daily ATM limit</dt>
                        <dd>{formatMinor(card.dailyAtmLimit)}</dd>
                      </div>
                      <div>
                        <dt>Expiry date</dt>
                        <dd>{formatExpiry(card.expiryMonth, card.expiryYear)}</dd>
                      </div>
                      <div>
                        <dt>Issued on</dt>
                        <dd>{formatDateLong(card.issuedAt)}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{STATUS_LABELS[card.status] || card.status}</dd>
                      </div>
                    </dl>

                    {card.status === 'blocked' ? (
                      <div className="card-notice">
                        This card is blocked. Contact bank support if you need assistance.
                      </div>
                    ) : (
                      <div className="card-tile__actions">
                        {card.status === 'inactive' ? (
                          <button
                            type="button"
                            className="db-btn db-btn--primary"
                            onClick={() => openModal('activate', card)}
                          >
                            Activate card
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="db-btn db-btn--primary"
                            onClick={() => openModal('changePin', card)}
                          >
                            Change PIN
                          </button>
                        )}
                        <button
                          type="button"
                          className="db-btn db-btn--outline"
                          onClick={() => openModal('limit', card)}
                        >
                          Set ATM limit
                        </button>
                        <button
                          type="button"
                          className="db-btn db-btn--danger"
                          onClick={() => openModal('block', card)}
                        >
                          Block card
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          {applications.length > 0 && (
            <section className="db-card" style={{ marginTop: 28 }}>
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Your debit card applications</h2>
                  <p className="db-card__sub">Track the status of your debit card requests.</p>
                </div>
              </div>
              <div className="db-table-wrap">
                <table className="db-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Linked Account</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => (
                      <tr key={app._id}>
                        <td>
                          <strong>{app.applicationNumber}</strong>
                        </td>
                        <td>
                          {app.account
                            ? `${ACCOUNT_TYPE_LABELS[app.account.type] || app.account.type} •••• ${last4(app.account.accountNumber)}`
                            : '—'}
                        </td>
                        <td>{formatDate(app.createdAt)}</td>
                        <td>
                          <span className={`pill pill--${app.status}`}>
                            {APPLICATION_STATUS_LABELS[app.status] || app.status}
                          </span>
                        </td>
                        <td>{app.remarks || (app.status === 'pending' ? 'Under bank review' : '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {modal?.kind === 'apply' && (
        <Modal
          title="Apply for a debit card"
          sub="Select the account this card will be linked to. Bank staff will review and approve your card."
          onClose={closeModal}
          busy={busy}
        >
          <form className="db-form" onSubmit={submitApply} style={{ marginTop: 0 }}>
            <div className="field">
              <label htmlFor="dc-account">Linked account</label>
              <select
                id="dc-account"
                className="input db-select"
                value={form.accountId}
                onChange={setField('accountId')}
              >
                {eligibleAccounts.map((account) => (
                  <option key={account._id} value={account._id}>
                    {ACCOUNT_TYPE_LABELS[account.type]} •••• {last4(account.accountNumber)}
                    {account.nickname ? ` (${account.nickname})` : ''} · {formatMinor(account.balance)}
                  </option>
                ))}
              </select>
              <div className="field-hint">
                Upon admin approval, a random hexadecimal PIN will be generated and emailed directly to your registered
                email address.
              </div>
            </div>
            {modalError && (
              <div className="db-alert db-alert--error" role="alert">
                {modalError}
              </div>
            )}
            <div className="db-form__actions">
              <button type="submit" className="db-btn db-btn--primary" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit application'}
              </button>
              <button type="button" className="db-btn db-btn--outline" onClick={closeModal} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'changePin' && (
        <Modal
          title="Change Card PIN"
          sub={`Update the PIN for debit card ending in •••• ${modal.card?.last4}.`}
          onClose={closeModal}
          busy={busy}
        >
          <form className="db-form" onSubmit={submitChangePin} style={{ marginTop: 0 }} autoComplete="off">
            <div className="db-form__row">
              <div className="field">
                <label htmlFor="dc-new-pin">New PIN</label>
                <input
                  id="dc-new-pin"
                  className="input input--code"
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 7F4A"
                  autoComplete="new-password"
                  value={form.pin}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pin: event.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase(),
                    }))
                  }
                  autoFocus
                />
              </div>
              <div className="field">
                <label htmlFor="dc-confirm-pin">Confirm PIN</label>
                <input
                  id="dc-confirm-pin"
                  className="input input--code"
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 7F4A"
                  autoComplete="new-password"
                  value={form.confirmPin}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      confirmPin: event.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase(),
                    }))
                  }
                />
              </div>
            </div>
            <div className="field-hint">
              Choose 4 to 6 characters (digits 0-9 or hexadecimal A-F). Avoid repetitive characters like 0000.
            </div>
            {modalError && (
              <div className="db-alert db-alert--error" role="alert">
                {modalError}
              </div>
            )}
            <div className="db-form__actions">
              <button type="submit" className="db-btn db-btn--primary" disabled={busy}>
                {busy ? 'Updating…' : 'Update PIN'}
              </button>
              <button type="button" className="db-btn db-btn--outline" onClick={closeModal} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'activate' && (
        <Modal
          title="Activate your card"
          sub={`Choose a PIN for the card ending in •••• ${modal.card?.last4}.`}
          onClose={closeModal}
          busy={busy}
        >
          <form className="db-form" onSubmit={submitActivate} style={{ marginTop: 0 }} autoComplete="off">
            <div className="db-form__row">
              <div className="field">
                <label htmlFor="dc-pin">PIN</label>
                <input
                  id="dc-pin"
                  className="input input--code"
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 9B2E"
                  autoComplete="new-password"
                  value={form.pin}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pin: event.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase(),
                    }))
                  }
                  autoFocus
                />
              </div>
              <div className="field">
                <label htmlFor="dc-pin2">Confirm PIN</label>
                <input
                  id="dc-pin2"
                  className="input input--code"
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 9B2E"
                  autoComplete="new-password"
                  value={form.confirmPin}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      confirmPin: event.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase(),
                    }))
                  }
                />
              </div>
            </div>
            <div className="field-hint">Enter 4 to 6 digits or hexadecimal characters (0-9, A-F). Never share your PIN.</div>
            {modalError && (
              <div className="db-alert db-alert--error" role="alert">
                {modalError}
              </div>
            )}
            <div className="db-form__actions">
              <button type="submit" className="db-btn db-btn--primary" disabled={busy}>
                {busy ? 'Activating…' : 'Activate card'}
              </button>
              <button type="button" className="db-btn db-btn--outline" onClick={closeModal} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'limit' && (
        <Modal
          title="Daily ATM limit"
          sub={`For the card ending ${modal.card.last4}. Between ${formatRupees(ATM_MIN_MINOR)} and ${formatRupees(ATM_MAX_MINOR)}.`}
          onClose={closeModal}
          busy={busy}
        >
          <form className="db-form" onSubmit={submitLimit} style={{ marginTop: 0 }}>
            <div className="field">
              <label htmlFor="dc-limit">Limit per day (₹)</label>
              <input
                id="dc-limit"
                className="input"
                type="text"
                inputMode="decimal"
                value={form.limit}
                onChange={setField('limit')}
                autoFocus
              />
            </div>
            {modalError && (
              <div className="db-alert db-alert--error" role="alert">
                {modalError}
              </div>
            )}
            <div className="db-form__actions">
              <button type="submit" className="db-btn db-btn--primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save limit'}
              </button>
              <button type="button" className="db-btn db-btn--outline" onClick={closeModal} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === 'block' && (
        <Modal
          title="Block this card?"
          sub={`The card ending ${modal.card.last4} will stop working immediately.`}
          onClose={closeModal}
          busy={busy}
        >
          <form className="db-form" onSubmit={submitBlock} style={{ marginTop: 0 }}>
            <p className="db-note" style={{ marginTop: 0 }}>
              Only bank staff can release a blocked card. If you just need a replacement, you can apply for a new
              card after blocking this one.
            </p>
            {modalError && (
              <div className="db-alert db-alert--error" role="alert">
                {modalError}
              </div>
            )}
            <div className="db-form__actions">
              <button type="submit" className="db-btn db-btn--primary" disabled={busy}>
                {busy ? 'Blocking…' : 'Block card'}
              </button>
              <button type="button" className="db-btn db-btn--outline" onClick={closeModal} disabled={busy}>
                Keep card
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  )
}
