import { formatExpiry, maskCard } from '../utils/format'

// The card graphic used on the debit/credit pages and the application preview.
// Only the last four digits ever reach the browser.
export default function CardVisual({
  kind = 'credit',
  last4,
  expiryMonth,
  expiryYear,
  status,
  label,
  value,
}) {
  const blocked = status === 'blocked'
  return (
    <div className={`cc-visual cc-visual--${kind}${blocked ? ' is-blocked' : ''}`}>
      <div className="cc-visual__top">
        <span className="cc-visual__brand">NORTHBANK</span>
        {status && <span className={`cc-visual__status cc-visual__status--${status}`}>{status}</span>}
      </div>

      <div className="cc-visual__mid">
        <span className="cc-visual__type">{kind === 'credit' ? 'Credit card' : 'Debit card'}</span>
        <span className="cc-visual__chip" aria-hidden="true" />
        <div className="cc-visual__num">{last4 ? maskCard(last4) : 'XXXX XXXX XXXX XXXX'}</div>
      </div>

      <div className="cc-visual__bottom">
        <div>
          <div className="cc-visual__label">{label}</div>
          <div className="cc-visual__value">{value}</div>
        </div>
        {expiryMonth ? (
          <div className="cc-visual__right">
            <div className="cc-visual__label">Expires</div>
            <div className="cc-visual__value">{formatExpiry(expiryMonth, expiryYear, true)}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
