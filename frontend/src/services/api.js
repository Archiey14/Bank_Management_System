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
  } catch (err) {
    // Ignore server-side logout errors in stateless JWT
  } finally {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }
}

export default API

