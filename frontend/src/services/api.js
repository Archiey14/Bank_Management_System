import axios from 'axios'

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return 'https://bank-management-system-vefi.onrender.com/api'
  }
  return 'http://localhost:5001/api'
}

const API = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
})

// Immediately pre-warm server in the background to eliminate cold-start wait times
if (typeof window !== 'undefined') {
  setTimeout(() => {
    API.get('/health').catch(() => {})
  }, 50)
}

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') ?? sessionStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isAuthUrl =
        error.config?.url?.includes('/auth/login') ||
        error.config?.url?.includes('/auth/register') ||
        error.config?.url?.includes('/auth/otp') ||
        error.config?.url?.includes('/auth/google')

      if (!isAuthUrl) {
        const hasToken = localStorage.getItem('token') || sessionStorage.getItem('token')
        if (hasToken) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          sessionStorage.removeItem('token')
          sessionStorage.removeItem('user')
          window.location.href = '/login?expired=true'
        }
      }
    }
    return Promise.reject(error)
  }
)

export const registerUser = async (data) => {
  const response = await API.post('/auth/register', data)
  return response.data
}

export const loginUser = async (data) => {
  const response = await API.post('/auth/login', data)
  return response.data
}

export const googleAuthUser = async (data) => {
  const response = await API.post('/auth/google', data)
  return response.data
}

export const getMe = async () => {
  const response = await API.get('/auth/me')
  return response.data
}

export const logoutUser = async () => {
  try {
    await API.post('/auth/logout')
  } catch {
    // Ignore server-side logout errors in stateless JWT
  } finally {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }
}

// Second step of sign-in: exchange the otpToken from /login for a session.
export const verifyLoginOtp = async ({ otpToken, code }) => {
  const response = await API.post('/auth/otp/verify', { otpToken, code })
  return response.data
}

export const updateProfile = async (payload) => {
  const body = typeof payload === 'string' ? { name: payload } : payload
  const response = await API.patch('/auth/me', body)
  return response.data
}

export const changePassword = async ({ currentPassword, newPassword, confirmPassword }) => {
  const response = await API.patch('/auth/password', {
    currentPassword,
    newPassword,
    confirmPassword,
  })
  return response.data
}

export const forgotPassword = async (email) => {
  const response = await API.post('/auth/forgot-password', { email })
  return response.data
}

export const resetPassword = async ({ token, password, confirmPassword }) => {
  const response = await API.post(`/auth/reset-password/${token}`, { password, confirmPassword })
  return response.data
}

// Money-moving requests carry an idempotency key so a retried request cannot
// move money twice. Generate one per logical attempt.
export const newIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `key-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

const moneyConfig = (idempotencyKey) =>
  idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined

export const getDashboardSummary = async ({ from, to } = {}) => {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to
  const response = await API.get('/dashboard/summary', { params })
  return response.data
}

export const listAccounts = async () => {
  const response = await API.get('/accounts')
  return response.data
}

export const openAccount = async (type, nickname = '') => {
  const response = await API.post('/accounts', { type, nickname: nickname || undefined })
  return response.data
}

export const updateAccount = async (accountId, { nickname, status }) => {
  const response = await API.patch(`/accounts/${accountId}`, {
    nickname: nickname !== undefined ? nickname : undefined,
    status: status !== undefined ? status : undefined,
  })
  return response.data
}

export const depositToAccount = async (accountId, { amountMinor, description, idempotencyKey }) => {
  const response = await API.post(
    `/accounts/${accountId}/deposit`,
    { amountMinor, description: description || undefined },
    moneyConfig(idempotencyKey)
  )
  return response.data
}

export const withdrawFromAccount = async (accountId, { amountMinor, description, idempotencyKey, isStaffAction = false }) => {
  const endpoint = isStaffAction ? `/accounts/${accountId}/withdraw` : `/accounts/${accountId}/atm-withdraw`
  const response = await API.post(
    endpoint,
    { amountMinor, description: description || undefined },
    moneyConfig(idempotencyKey)
  )
  return response.data
}

export const listTransactions = async (params = {}) => {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)
  )
  const response = await API.get('/transactions', { params: query })
  return response.data
}

export const createTransfer = async ({
  fromAccountId,
  toAccountNumber,
  amountMinor,
  description,
  category,
  idempotencyKey,
}) => {
  const response = await API.post(
    '/transfers',
    {
      fromAccountId,
      toAccountNumber,
      amountMinor,
      description: description || undefined,
      category: category || undefined,
    },
    moneyConfig(idempotencyKey)
  )
  return response.data
}

export const createAccountApplication = async (payload) => {
  const response = await API.post('/applications', payload)
  return response.data
}

export const listMyApplications = async () => {
  const response = await API.get('/applications/mine')
  return response.data
}

export const listApplications = async (params = {}) => {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)
  )
  const response = await API.get('/applications', { params: query })
  return response.data
}

export const approveApplication = async (id) => {
  const response = await API.patch(`/applications/${id}/approve`)
  return response.data
}

export const rejectApplication = async (id, remarks) => {
  const response = await API.patch(`/applications/${id}/reject`, { remarks })
  return response.data
}

export const listBeneficiaries = async () => {
  const response = await API.get('/beneficiaries')
  return response.data
}

export const createBeneficiary = async ({ name, accountNumber, nickname }) => {
  const response = await API.post('/beneficiaries', { name, accountNumber, nickname: nickname || undefined })
  return response.data
}

export const deleteBeneficiary = async (id) => {
  const response = await API.delete(`/beneficiaries/${id}`)
  return response.data
}

export const listFixedDeposits = async () => {
  const response = await API.get('/fixed-deposits')
  return response.data
}

export const bookFixedDeposit = async ({ sourceAccountId, principalMinor, tenureMonths, idempotencyKey }) => {
  const response = await API.post(
    '/fixed-deposits',
    { sourceAccountId, principalMinor, tenureMonths },
    moneyConfig(idempotencyKey)
  )
  return response.data
}

export const settleFixedDeposit = async (id) => {
  const response = await API.post(`/fixed-deposits/${id}/settle`)
  return response.data
}

export const getStaffOverview = async (days = 7) => {
  const response = await API.get('/staff/overview', { params: { days } })
  return response.data
}

export const listStaffAccounts = async (params = {}) => {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)
  )
  const response = await API.get('/staff/accounts', { params: query })
  return response.data
}

export const setAccountStatus = async (accountId, status) => {
  const response = await API.patch(`/accounts/${accountId}/status`, { status })
  return response.data
}

export const staffOpenAccount = async (payload) => {
  const response = await API.post('/staff/accounts', payload)
  return response.data
}

export const listFlaggedTransfers = async (params = {}) => {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)
  )
  const response = await API.get('/staff/flagged-transfers', { params: query })
  return response.data
}

export const reviewFlaggedTransfer = async (id, { reviewStatus, reviewNote }) => {
  const response = await API.patch(`/staff/flagged-transfers/${id}/review`, {
    reviewStatus,
    reviewNote,
  })
  return response.data
}

// Admin APIs
export const listAdminUsers = async (params = {}) => {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)
  )
  const response = await API.get('/admin/users', { params: query })
  return response.data
}

export const createAdminUser = async (payload) => {
  const response = await API.post('/admin/users', payload)
  return response.data
}

export const updateAdminUser = async (id, payload) => {
  const response = await API.patch(`/admin/users/${id}`, payload)
  return response.data
}

export const listAdminAuditLogs = async (params = {}) => {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)
  )
  const response = await API.get('/admin/audit-logs', { params: query })
  return response.data
}

export const getAdminReports = async () => {
  const response = await API.get('/admin/reports')
  return response.data
}

// ---- Cards ----
export const listDebitCards = async () => {
  const response = await API.get('/cards/debit')
  return response.data
}

export const requestDebitCard = async (accountId) => {
  const response = await API.post('/cards/debit', { accountId })
  return response.data
}

export const activateDebitCard = async (id, pin) => {
  const response = await API.post(`/cards/debit/${id}/activate`, { pin })
  return response.data
}

export const changeDebitCardPin = async (id, pin) => {
  const response = await API.post(`/cards/debit/${id}/pin`, { pin })
  return response.data
}

export const setDebitCardLimit = async (id, dailyAtmLimitMinor) => {
  const response = await API.patch(`/cards/debit/${id}/limit`, { dailyAtmLimitMinor })
  return response.data
}

export const blockDebitCard = async (id) => {
  const response = await API.post(`/cards/debit/${id}/block`)
  return response.data
}

export const applyDebitCard = async (accountId) => {
  const response = await API.post('/cards/debit-applications', { accountId })
  return response.data
}

export const listMyDebitApplications = async () => {
  const response = await API.get('/cards/debit-applications/mine')
  return response.data
}

export const listDebitApplications = async (params = {}) => {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)
  )
  const response = await API.get('/cards/debit-applications', { params: query })
  return response.data
}

export const approveDebitApplication = async (id) => {
  const response = await API.patch(`/cards/debit-applications/${id}/approve`)
  return response.data
}

export const rejectDebitApplication = async (id, remarks) => {
  const response = await API.patch(`/cards/debit-applications/${id}/reject`, { remarks })
  return response.data
}

export const listCreditCards = async () => {
  const response = await API.get('/cards/credit')
  return response.data
}

export const changeCreditCardPin = async (id, pin) => {
  const response = await API.post(`/cards/credit/${id}/pin`, { pin })
  return response.data
}

export const listCreditCardTransactions = async (id, limit = 10) => {
  const response = await API.get(`/cards/credit/${id}/transactions`, { params: { limit } })
  return response.data
}

export const purchaseWithCreditCard = async (id, { amountMinor, merchant, idempotencyKey }) => {
  const response = await API.post(
    `/cards/credit/${id}/purchase`,
    { amountMinor, merchant },
    moneyConfig(idempotencyKey)
  )
  return response.data
}

export const repayCreditCard = async (id, { amountMinor, fromAccountId, idempotencyKey }) => {
  const response = await API.post(
    `/cards/credit/${id}/repay`,
    { amountMinor, fromAccountId },
    moneyConfig(idempotencyKey)
  )
  return response.data
}

export const blockCreditCard = async (id) => {
  const response = await API.post(`/cards/credit/${id}/block`)
  return response.data
}

export const createCreditApplication = async ({ requestedLimitMinor }) => {
  const response = await API.post('/cards/credit-applications', {
    requestedLimitMinor,
    confirm: true,
  })
  return response.data
}

export const listMyCreditApplications = async () => {
  const response = await API.get('/cards/credit-applications/mine')
  return response.data
}

export const listCreditApplications = async (params = {}) => {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)
  )
  const response = await API.get('/cards/credit-applications', { params: query })
  return response.data
}

export const approveCreditApplication = async (id, approvedLimitMinor) => {
  const response = await API.patch(`/cards/credit-applications/${id}/approve`, {
    approvedLimitMinor: approvedLimitMinor || undefined,
  })
  return response.data
}

export const rejectCreditApplication = async (id, remarks) => {
  const response = await API.patch(`/cards/credit-applications/${id}/reject`, { remarks })
  return response.data
}

export const listBlockedCards = async () => {
  const response = await API.get('/cards/staff/blocked')
  return response.data
}

export const setStaffCardStatus = async (kind, id, status) => {
  const response = await API.patch(`/cards/staff/${kind}/${id}/status`, { status })
  return response.data
}

export const getLimits = async () => {
  const response = await API.get('/limits')
  return response.data
}

export default API

