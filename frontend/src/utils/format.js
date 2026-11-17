export const ACCOUNT_TYPE_LABELS = {
  savings: 'Savings',
  current: 'Current',
  fixed_deposit: 'Fixed deposit',
}

export const TRANSACTION_TYPE_LABELS = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  bill_payment: 'Bill payment',
  fd_booking: 'FD booked',
  fd_credit: 'FD payout',
}

export const OCCUPATIONS = [
  'Salaried',
  'Self-employed',
  'Business owner',
  'Student',
  'Retired',
  'Homemaker',
  'Other',
]

export const INCOME_BANDS = [
  { value: 'below_2l', label: 'Below ₹2 lakh' },
  { value: '2l_to_5l', label: '₹2 – 5 lakh' },
  { value: '5l_to_10l', label: '₹5 – 10 lakh' },
  { value: '10l_to_25l', label: '₹10 – 25 lakh' },
  { value: 'above_25l', label: 'Above ₹25 lakh' },
]

export const incomeBandLabel = (value) =>
  INCOME_BANDS.find((band) => band.value === value)?.label || value

export const APPLICATION_STATUS_LABELS = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const last4 = (accountNumber = '') => String(accountNumber).slice(-4)

export const maskCard = (digits = '') => `•••• •••• •••• ${digits}`

// 10/2031 (or 10/31 when short)
export const formatExpiry = (month, year, short = false) =>
  `${String(month).padStart(2, '0')}/${short ? String(year).slice(-2) : year}`

// 21 Oct 2026, 10:59 am
export const formatDateTimeLong = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// 21 Oct 2026
export const formatDateLong = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const maskAccount = (accountNumber = '') =>
  accountNumber ? `•••• ${last4(accountNumber)}` : '—'

export const formatDate = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const formatDateTime = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const monthLabel = (monthKey) => {
  if (!monthKey) return ''
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' })
}
