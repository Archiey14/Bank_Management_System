import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import CardVisual from '../components/CardVisual'
import Modal from '../components/Modal'
import {
  blockCreditCard,
  changeCreditCardPin,
  listAccounts,
  listCreditCards,
  listCreditCardTransactions,
  listMyCreditApplications,
  newIdempotencyKey,
  purchaseWithCreditCard,
  repayCreditCard,
} from '../services/api'
import { formatMinor, formatRupees, toMinorUnits } from '../utils/money'
import {
  ACCOUNT_TYPE_LABELS,
  formatDateLong,
  formatDateTime,
  formatDateTimeLong,
  last4,
} from '../utils/format'

export default function CreditCards() {
  const [cards, setCards] = useState([])
  const [accounts, setAccounts] = useState([])
  const [applications, setApplications] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState('')

  const [purchase, setPurchase] = useState({ merchant: '', amount: '' })
  const [purchaseBusy, setPurchaseBusy] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')
  const purchaseKey = useRef(newIdempotencyKey())

  const [repay, setRepay] = useState({ accountId: '', amount: '' })
  const [repayBusy, setRepayBusy] = useState(false)
  const [repayError, setRepayError] = useState('')
  const repayKey = useRef(newIdempotencyKey())

  const [showBlock, setShowBlock] = useState(false)
  const [blockBusy, setBlockBusy] = useState(false)
  const [blockError, setBlockError] = useState('')

  const [showPinModal, setShowPinModal] = useState(false)
  const [pinForm, setPinForm] = useState({ pin: '', confirmPin: '' })
  const [pinBusy, setPinBusy] = useState(false)
  const [pinError, setPinError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([listCreditCards(), listAccounts(), listMyCreditApplications()])
      .then(([cardData, accountData, applicationData]) => {
        if (!active) return
        setCards(cardData.cards)
        setAccounts(accountData.accounts)
        setApplications(applicationData.applications)
        setLoadError('')
        setSelectedId((current) =>
          cardData.cards.some((card) => card._id === current) ? current : cardData.cards[0]?._id || ''
        )
        const firstActive = accountData.accounts.find((account) => account.status === 'active')
        setRepay((current) => ({
          ...current,
          accountId: accountData.accounts.some(
            (account) => account._id === current.accountId && account.status === 'active'
          )
            ? current.accountId
            : firstActive?._id || '',
        }))
      })
      .catch((err) => {
        if (active) setLoadError(err.response?.data?.message || 'Could not load your credit cards.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const card = cards.find((item) => item._id === selectedId) || null
  const cardId = card?._id

  useEffect(() => {
    if (!cardId) return undefined
    let active = true
    listCreditCardTransactions(cardId, 10)
      .then((data) => {
        if (active) setActivity(data.transactions)
      })
      .catch(() => {
        if (active) setActivity([])
      })
    return () => {
      active = false
    }
  }, [cardId, reloadKey])

  const refresh = () => setReloadKey((key) => key + 1)
  const activeAccounts = accounts.filter((account) => account.status === 'active')
  const repayAccount = accounts.find((account) => account._id === repay.accountId)
  const pendingApplication = applications.find((application) => application.status === 'pending')

  const handlePurchase = async (event) => {
    event.preventDefault()
    setPurchaseError('')
    setNotice('')
    const merchant = purchase.merchant.trim()
    const amountMinor = toMinorUnits(purchase.amount)
    if (merchant.length < 2) {
      setPurchaseError('Enter the merchant name.')
      return
    }
    if (!amountMinor) {
      setPurchaseError('Enter an amount greater than zero, with at most 2 decimals.')
      return
    }
    if (amountMinor > card.availableCredit) {
      setPurchaseError(`This is more than your available credit of ${formatMinor(card.availableCredit)}.`)
      return
    }

    setPurchaseBusy(true)
    try {
      const data = await purchaseWithCreditCard(card._id, {
        amountMinor,
        merchant,
        idempotencyKey: purchaseKey.current,
      })
      purchaseKey.current = newIdempotencyKey()
      setPurchase({ merchant: '', amount: '' })
      setNotice(
        data.replayed
          ? 'This purchase was already processed — you were not charged twice.'
          : `Charged ${formatMinor(amountMinor)} at ${merchant}.`
      )
      refresh()
    } catch (err) {
      setPurchaseError(err.response?.data?.message || 'The purchase failed. Please try again.')
      if (err.response) purchaseKey.current = newIdempotencyKey()
    } finally {
      setPurchaseBusy(false)
    }
  }

  const handleRepay = async (event) => {
    event.preventDefault()
    setRepayError('')
    setNotice('')
    const amountMinor = toMinorUnits(repay.amount)
    if (!repay.accountId) {
      setRepayError('Choose the account to pay from.')
      return
    }
    if (!amountMinor) {
      setRepayError('Enter an amount greater than zero, with at most 2 decimals.')
      return
    }
    if (amountMinor > card.outstanding) {
      setRepayError(`The most you can pay is the outstanding balance of ${formatMinor(card.outstanding)}.`)
      return
    }
    if (repayAccount && amountMinor > repayAccount.balance) {
      setRepayError(`Insufficient funds. Available balance: ${formatMinor(repayAccount.balance)}.`)
      return
    }

    setRepayBusy(true)
    try {
      const data = await repayCreditCard(card._id, {
        amountMinor,
        fromAccountId: repay.accountId,
        idempotencyKey: repayKey.current,
      })
      repayKey.current = newIdempotencyKey()
      setRepay((current) => ({ ...current, amount: '' }))
      setNotice(
        data.replayed
          ? 'This payment was already processed — no money moved twice.'
          : `Paid ${formatMinor(amountMinor)} towards your credit card.`
      )
      refresh()
    } catch (err) {
      setRepayError(err.response?.data?.message || 'The payment failed. Please try again.')
      if (err.response) repayKey.current = newIdempotencyKey()
    } finally {
      setRepayBusy(false)
    }
  }

  const handlePinSubmit = async (event) => {
    event.preventDefault()
    setPinError('')
    const cleanPin = pinForm.pin.trim().toUpperCase()
    if (!/^[0-9A-F]{4,6}$/.test(cleanPin)) {
      setPinError('PIN must be 4 to 6 characters (digits 0-9 or hexadecimal A-F).')
      return
    }
    if (cleanPin !== pinForm.confirmPin.trim().toUpperCase()) {
      setPinError('The two PINs do not match.')
      return
    }

    setPinBusy(true)
    try {
      await changeCreditCardPin(card._id, cleanPin)
      setShowPinModal(false)
      setPinForm({ pin: '', confirmPin: '' })
      setNotice('Credit card PIN updated successfully.')
      refresh()
    } catch (err) {
      setPinError(err.response?.data?.message || 'Could not update your PIN. Please try again.')
    } finally {
      setPinBusy(false)
    }
  }

  const handleBlock = async (event) => {
    event.preventDefault()
    setBlockBusy(true)
    setBlockError('')
    try {
      await blockCreditCard(card._id)
      setShowBlock(false)
      setNotice('Card blocked. Contact bank support to release it.')
      refresh()
    } catch (err) {
      setBlockError(err.response?.data?.message || 'Could not block the card.')
    } finally {
      setBlockBusy(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Northbank · Personal banking"
        title="Credit Cards"
        sub="Manage your credit, monitor spending, make purchases, and repay your outstanding balance."
        actions={
          <>
            <button
              type="button"
              className="db-btn db-btn--outline"
              onClick={() => {
                setNotice('')
                refresh()
              }}
            >
              Refresh
            </button>
            <Link to="/cards/credit/apply" className="db-btn db-btn--primary">
              Apply for a card
            </Link>
          </>
        }
      />

      {notice && (
        <div className="db-alert db-alert--success" role="status">
          {notice}
        </div>
      )}

      {loading && <div className="db-loading">Loading your credit cards…</div>}

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

      {!loading && !loadError && !card && (
        <div className="db-empty">
          <div className="db-empty__title">
            {pendingApplication ? 'Your application is under review' : 'You do not have a credit card yet'}
          </div>
          <p className="db-empty__text">
            {pendingApplication
              ? `Application ${pendingApplication.applicationNumber} for a ${formatRupees(pendingApplication.requestedLimit)} limit is waiting for bank review. Your card appears here once it is approved.`
              : 'Apply for a Northbank credit card. The bank reviews every application before a card is issued.'}
          </p>
          {!pendingApplication && (
            <Link to="/cards/credit/apply" className="db-btn db-btn--primary">
              Apply for a credit card
            </Link>
          )}
        </div>
      )}

      {!loading && !loadError && card && (
        <>
          {cards.length > 1 && (
            <div className="cc-picker" role="tablist" aria-label="Choose a card">
              {cards.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className={item._id === card._id ? 'is-active' : ''}
                  onClick={() => {
                    setSelectedId(item._id)
                    setActivity([])
                    setPurchaseError('')
                    setRepayError('')
                  }}
                >
                  •••• {item.last4}
                  {item.status === 'blocked' ? ' · Blocked' : ''}
                </button>
              ))}
            </div>
          )}

          <div className="cc-hero">
            <CardVisual
              kind="credit"
              last4={card.last4}
              expiryMonth={card.expiryMonth}
              expiryYear={card.expiryYear}
              status={card.status}
              label="Credit limit"
              value={formatMinor(card.creditLimit)}
            />
          </div>

          <section className="db-card" style={{ marginTop: 20 }}>
            <div className="db-card__head">
              <div>
                <h2 className="db-card__title">Card overview</h2>
                <p className="db-card__sub">•••• •••• •••• {card.last4} · Selected card</p>
              </div>
              {card.status === 'active' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="db-btn db-btn--outline"
                    onClick={() => {
                      setPinError('')
                      setPinForm({ pin: '', confirmPin: '' })
                      setShowPinModal(true)
                    }}
                  >
                    Change PIN
                  </button>
                  <button
                    type="button"
                    className="db-btn db-btn--danger"
                    onClick={() => {
                      setBlockError('')
                      setShowBlock(true)
                    }}
                  >
                    Block card
                  </button>
                </div>
              )}
            </div>

            <div className="cc-stats">
              <div className="cc-stat cc-stat--limit">
                <div className="cc-stat__label">Credit limit</div>
                <div className="cc-stat__value">{formatMinor(card.creditLimit)}</div>
                <div className="cc-stat__hint">Your total approved credit</div>
              </div>
              <div className="cc-stat cc-stat--owed">
                <div className="cc-stat__label">Outstanding balance</div>
                <div className="cc-stat__value">{formatMinor(card.outstanding)}</div>
                <div className="cc-stat__hint">Amount currently owed</div>
              </div>
              <div className="cc-stat cc-stat--avail">
                <div className="cc-stat__label">Available credit</div>
                <div className="cc-stat__value">{formatMinor(card.availableCredit)}</div>
                <div className="cc-stat__hint">Credit remaining to spend</div>
              </div>
            </div>
          </section>

          <section className="db-card" style={{ marginTop: 20 }}>
            <div className="db-card__head">
              <div>
                <h2 className="db-card__title">Card details</h2>
              </div>
            </div>
            <dl className="card-facts" style={{ marginTop: 18 }}>
              <div>
                <dt>Billing day</dt>
                <dd>{card.billingDay} of each month</dd>
              </div>
              <div>
                <dt>Payment due date</dt>
                <dd>{card.dueDate ? formatDateLong(card.dueDate) : 'Not scheduled'}</dd>
              </div>
              <div>
                <dt>Card status</dt>
                <dd>
                  <span className={`pill pill--${card.status}`}>{card.status}</span>
                </dd>
              </div>
              <div>
                <dt>Activated on</dt>
                <dd>{formatDateTimeLong(card.activatedAt)}</dd>
              </div>
            </dl>
            {card.status === 'blocked' && (
              <div className="card-notice" style={{ marginTop: 16 }}>
                This card is blocked. Purchases are disabled — you can still repay your balance. Contact bank
                support to release the card.
              </div>
            )}
          </section>

          <div className="db-page-grid db-page-grid--equal">
            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Make a purchase</h2>
                  <p className="db-card__sub">Available credit: {formatMinor(card.availableCredit)}</p>
                </div>
              </div>
              <form className="db-form" onSubmit={handlePurchase}>
                <div className="field">
                  <label htmlFor="cc-merchant">Merchant</label>
                  <input
                    id="cc-merchant"
                    className="input"
                    type="text"
                    maxLength={60}
                    placeholder="e.g. Grocery store, Online shop"
                    value={purchase.merchant}
                    onChange={(event) => setPurchase((current) => ({ ...current, merchant: event.target.value }))}
                    disabled={card.status !== 'active'}
                  />
                </div>
                <div className="field">
                  <label htmlFor="cc-amount">Amount (₹)</label>
                  <input
                    id="cc-amount"
                    className="input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={purchase.amount}
                    onChange={(event) => setPurchase((current) => ({ ...current, amount: event.target.value }))}
                    disabled={card.status !== 'active'}
                  />
                </div>
                {purchaseError && (
                  <div className="db-alert db-alert--error" role="alert">
                    {purchaseError}
                  </div>
                )}
                <div className="db-form__actions">
                  <button
                    type="submit"
                    className="db-btn db-btn--primary"
                    disabled={purchaseBusy || card.status !== 'active'}
                  >
                    {purchaseBusy ? 'Processing…' : 'Pay with card'}
                  </button>
                  <span className="db-form__hint">Simulated purchase — no real merchant is charged.</span>
                </div>
              </form>
            </section>

            <section className="db-card">
              <div className="db-card__head">
                <div>
                  <h2 className="db-card__title">Repay balance</h2>
                  <p className="db-card__sub">Outstanding: {formatMinor(card.outstanding)}</p>
                </div>
              </div>
              {card.outstanding === 0 ? (
                <div className="db-empty">
                  <div className="db-empty__title">Nothing to pay</div>
                  <p className="db-empty__text">You have no outstanding balance on this card.</p>
                </div>
              ) : activeAccounts.length === 0 ? (
                <div className="db-empty">
                  <div className="db-empty__title">No active accounts</div>
                  <p className="db-empty__text">You need an active account with funds to repay your card.</p>
                </div>
              ) : (
                <form className="db-form" onSubmit={handleRepay}>
                  <div className="field">
                    <label htmlFor="cc-from">Pay from</label>
                    <select
                      id="cc-from"
                      className="input db-select"
                      value={repay.accountId}
                      onChange={(event) => setRepay((current) => ({ ...current, accountId: event.target.value }))}
                    >
                      {activeAccounts.map((account) => (
                        <option key={account._id} value={account._id}>
                          {ACCOUNT_TYPE_LABELS[account.type]} •••• {last4(account.accountNumber)} ·{' '}
                          {formatMinor(account.balance)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="cc-repay-amount">Amount (₹)</label>
                    <input
                      id="cc-repay-amount"
                      className="input"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={repay.amount}
                      onChange={(event) => setRepay((current) => ({ ...current, amount: event.target.value }))}
                    />
                  </div>
                  {repayError && (
                    <div className="db-alert db-alert--error" role="alert">
                      {repayError}
                    </div>
                  )}
                  <div className="db-form__actions">
                    <button type="submit" className="db-btn db-btn--primary" disabled={repayBusy}>
                      {repayBusy ? 'Processing…' : 'Pay now'}
                    </button>
                    <button
                      type="button"
                      className="db-btn db-btn--outline"
                      onClick={() =>
                        setRepay((current) => ({ ...current, amount: String(card.outstanding / 100) }))
                      }
                    >
                      Pay full balance
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>

          <section className="db-card" style={{ marginTop: 20 }}>
            <div className="db-card__head">
              <div>
                <h2 className="db-card__title">Recent card activity</h2>
                <p className="db-card__sub">Your last 10 purchases and payments on this card.</p>
              </div>
            </div>
            {activity.length === 0 ? (
              <div className="db-empty">
                <div className="db-empty__title">No activity yet</div>
                <p className="db-empty__text">Purchases and repayments will show up here.</p>
              </div>
            ) : (
              <div className="db-table-wrap">
                <table className="db-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Details</th>
                      <th className="num">Amount</th>
                      <th className="num">Balance owed after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((entry) => (
                      <tr key={entry._id}>
                        <td>{formatDateTime(entry.createdAt)}</td>
                        <td>
                          <div className="db-table__title">
                            {entry.type === 'purchase' ? entry.merchant || 'Purchase' : 'Card payment'}
                          </div>
                          <div className="db-table__sub">{entry.description}</div>
                        </td>
                        <td className={`num ${entry.type === 'repayment' ? 'cc-activity-in' : ''}`}>
                          {entry.type === 'repayment' ? '−' : '+'}
                          {formatMinor(entry.amount)}
                        </td>
                        <td className="num">{formatMinor(entry.outstandingAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {showBlock && card && (
        <Modal
          title="Block this card?"
          sub={`The card ending ${card.last4} will stop accepting purchases immediately.`}
          onClose={() => {
            if (!blockBusy) setShowBlock(false)
          }}
          busy={blockBusy}
        >
          <form className="db-form" onSubmit={handleBlock} style={{ marginTop: 0 }}>
            <p className="db-note" style={{ marginTop: 0 }}>
              You can still repay your outstanding balance. Only bank staff can release a blocked card.
            </p>
            {blockError && (
              <div className="db-alert db-alert--error" role="alert">
                {blockError}
              </div>
            )}
            <div className="db-form__actions">
              <button type="submit" className="db-btn db-btn--primary" disabled={blockBusy}>
                {blockBusy ? 'Blocking…' : 'Block card'}
              </button>
              <button
                type="button"
                className="db-btn db-btn--outline"
                onClick={() => setShowBlock(false)}
                disabled={blockBusy}
              >
                Keep card
              </button>
            </div>
          </form>
        </Modal>
      )}
      {showPinModal && card && (
        <Modal
          title="Change Credit Card PIN"
          sub={`Update the PIN for credit card ending in •••• ${card.last4}.`}
          onClose={() => {
            if (!pinBusy) setShowPinModal(false)
          }}
          busy={pinBusy}
        >
          <form className="db-form" onSubmit={handlePinSubmit} style={{ marginTop: 0 }} autoComplete="off">
            <div className="db-form__row">
              <div className="field">
                <label htmlFor="cc-new-pin">New PIN</label>
                <input
                  id="cc-new-pin"
                  className="input input--code"
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 7E2B"
                  autoComplete="new-password"
                  value={pinForm.pin}
                  onChange={(event) =>
                    setPinForm((current) => ({
                      ...current,
                      pin: event.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase(),
                    }))
                  }
                  autoFocus
                />
              </div>
              <div className="field">
                <label htmlFor="cc-confirm-pin">Confirm PIN</label>
                <input
                  id="cc-confirm-pin"
                  className="input input--code"
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 7E2B"
                  autoComplete="new-password"
                  value={pinForm.confirmPin}
                  onChange={(event) =>
                    setPinForm((current) => ({
                      ...current,
                      confirmPin: event.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase(),
                    }))
                  }
                />
              </div>
            </div>
            <div className="field-hint">
              Enter 4 to 6 digits or hexadecimal characters (0-9, A-F). Keep this PIN secret.
            </div>
            {pinError && (
              <div className="db-alert db-alert--error" role="alert">
                {pinError}
              </div>
            )}
            <div className="db-form__actions">
              <button type="submit" className="db-btn db-btn--primary" disabled={pinBusy}>
                {pinBusy ? 'Updating…' : 'Update PIN'}
              </button>
              <button
                type="button"
                className="db-btn db-btn--outline"
                onClick={() => setShowPinModal(false)}
                disabled={pinBusy}
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
