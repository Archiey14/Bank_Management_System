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
}

export const last4 = (accountNumber = '') => String(accountNumber).slice(-4)

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
