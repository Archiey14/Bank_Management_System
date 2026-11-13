import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (localStorage.getItem('token')) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
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

export const updateProfile = async (name) => {
  const response = await API.patch('/auth/me', { name })
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

// Money-moving requests carry an idempotency key so a retried request cannot
// move money twice. Generate one per logical attempt.
export const newIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `key-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

const moneyConfig = (idempotencyKey) =>
  idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined

export const getDashboardSummary = async () => {
  const response = await API.get('/dashboard/summary')
  return response.data
}

export const listAccounts = async () => {
  const response = await API.get('/accounts')
  return response.data
}

export const openAccount = async (type) => {
  const response = await API.post('/accounts', { type })
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
  idempotencyKey,
}) => {
  const response = await API.post(
    '/transfers',
    { fromAccountId, toAccountNumber, amountMinor, description: description || undefined },
    moneyConfig(idempotencyKey)
  )
  return response.data
}

export default API

