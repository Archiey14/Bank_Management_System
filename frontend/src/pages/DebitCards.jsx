import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import CardVisual from '../components/CardVisual'
import Modal from '../components/Modal'
import {
  activateDebitCard,
  blockDebitCard,
  listAccounts,
  listDebitCards,
  requestDebitCard,
  setDebitCardLimit,
} from '../services/api'
import { formatMinor, formatRupees, toMinorUnits } from '../utils/money'
import {
  ACCOUNT_TYPE_LABELS,
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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [modal, setModal] = useState(null) // { kind: 'request' | 'activate' | 'limit' | 'block', card }
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([listDebitCards(), listAccounts()])
      .then(([cardData, accountData]) => {
        if (!active) return
        setCards(cardData.cards)
        setAccounts(accountData.accounts)
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

  const submitRequest = (event) => {
    event.preventDefault()
    if (!form.accountId) {
      setModalError('Choose the account this card will be linked to.')
      return
    }
    run(() => requestDebitCard(form.accountId), 'Debit card issued. Activate it to start using it.')
  }

  const submitActivate = (event) => {
    event.preventDefault()
    if (!/^\d{4}$/.test(form.pin)) {
      setModalError('Your PIN must be exactly 4 digits.')
      return
    }
    if (form.pin !== form.confirmPin) {
      setModalError('The two PINs do not match.')
      return
    }
    run(() => activateDebitCard(modal.card._id, form.pin), 'Card activated. You can use it now.')
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
        sub="Request cards, activate them with a PIN, set your daily ATM limit and block a card if it is lost."
        actions={
          <button
            type="button"
            className="db-btn db-btn--primary"
            onClick={() => openModal('request')}
            disabled={loading || eligibleAccounts.length === 0}
            title={eligibleAccounts.length === 0 ? 'You need an active savings or current account' : undefined}
          >
            + Request new card
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
            <button type="button" className="db-btn db-btn--outline" onClick={() => { setLoading(true); refresh() }}>
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
                  ? 'Open a savings or current account first, then request a debit card for it.'
                  : 'Request a debit card for one of your accounts. You will set a PIN when you activate it.'}
              </p>
              {eligibleAccounts.length === 0 ? (
                <Link to="/accounts" className="db-btn db-btn--primary">
                  Go to my accounts
                </Link>
              ) : (
                <button type="button" className="db-btn db-btn--primary" onClick={() => openModal('request')}>
                  Request a debit card
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
                        <dt>Activated on</dt>
                        <dd>{card.activatedAt ? formatDateTimeLong(card.activatedAt) : '—'}</dd>
                      </div>
                    </dl>

                    {card.status === 'blocked' ? (
                      <div className="card-notice">
                        This card is blocked. Contact bank support if you need assistance.
                      </div>
                    ) : (
                      <div className="card-tile__actions">
                        {card.status === 'inactive' && (
                          <button
                            type="button"
                            className="db-btn db-btn--primary"
                            onClick={() => openModal('activate', card)}
                          >
                            Activate card
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
        </>
      )}

      {modal?.kind === 'request' && (
        <Modal
          title="Request a debit card"
          sub="The card is linked to one of your accounts. You will set a PIN when you activate it."
          onClose={closeModal}
          busy={busy}
        >
          <form className="db-form" onSubmit={submitRequest} style={{ marginTop: 0 }}>
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
              <div className="field-hint">Each account can have up to 2 live debit cards.</div>
            </div>
            {modalError && (
              <div className="db-alert db-alert--error" role="alert">
                {modalError}
              </div>
            )}
            <div className="db-form__actions">
              <button type="submit" className="db-btn db-btn--primary" disabled={busy}>
                {busy ? 'Requesting…' : 'Request card'}
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
          sub={`Choose a 4-digit PIN for the card ending ${modal.card.last4}.`}
          onClose={closeModal}
          busy={busy}
        >
          <form className="db-form" onSubmit={submitActivate} style={{ marginTop: 0 }} autoComplete="off">
            <div className="db-form__row">
              <div className="field">
                <label htmlFor="dc-pin">New PIN</label>
                <input
                  id="dc-pin"
                  className="input input--code"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="new-password"
                  value={form.pin}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, pin: event.target.value.replace(/\D/g, '') }))
                  }
                  autoFocus
                />
              </div>
              <div className="field">
                <label htmlFor="dc-pin2">Confirm PIN</label>
                <input
                  id="dc-pin2"
                  className="input input--code"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="new-password"
                  value={form.confirmPin}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, confirmPin: event.target.value.replace(/\D/g, '') }))
                  }
                />
              </div>
            </div>
            <div className="field-hint">Avoid easy PINs such as 1234 or 0000. Never share your PIN.</div>
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
              Only bank staff can release a blocked card. If you just need a replacement, you can request a new
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
