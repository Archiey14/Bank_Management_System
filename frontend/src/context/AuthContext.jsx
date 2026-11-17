import { useEffect, useState } from 'react'
import { getMe, loginUser, verifyLoginOtp as verifyLoginOtpApi, logoutUser, registerUser } from '../services/api'
import { AuthContext } from './authStore'

// Token and user object can live in either storage depending on "Remember me".
// We check localStorage first, then sessionStorage, so only one is ever set.
const readStorage = (key) =>
  localStorage.getItem(key) ?? sessionStorage.getItem(key)

const writeStorage = (key, value, persist) => {
  if (persist) {
    localStorage.setItem(key, value)
    sessionStorage.removeItem(key)
  } else {
    sessionStorage.setItem(key, value)
    localStorage.removeItem(key)
  }
}

const clearStorage = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('user')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // A corrupted value (e.g. the text "undefined") must not crash the app.
    try {
      const saved = readStorage('user')
      return saved ? JSON.parse(saved) : null
    } catch {
      clearStorage()
      return null
    }
  })
  const [token, setToken] = useState(() => readStorage('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = readStorage('token')
      if (savedToken) {
        try {
          const data = await getMe()
          setUser(data.user)
          // Keep the same storage the token is already in.
          const persist = Boolean(localStorage.getItem('token'))
          writeStorage('user', JSON.stringify(data.user), persist)
        } catch {
          clearStorage()
          setUser(null)
          setToken(null)
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  // persist = true  → localStorage  (remembered across browser restarts)
  // persist = false → sessionStorage (cleared when the tab closes)
  const startSession = (data, persist = true) => {
    writeStorage('token', data.token, persist)
    writeStorage('user', JSON.stringify(data.user), persist)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  /**
   * First sign-in step. Always returns { otpRequired: true, otpToken, remember }
   * — the server emails a one-time code after the password is verified.
   */
  const login = async (email, password, remember = true) => {
    const data = await loginUser({ email, password })
    if (data.otpRequired) {
      return { otpRequired: true, otpToken: data.otpToken, remember }
    }
    return { otpRequired: false, user: startSession(data, remember) }
  }

  /** Second sign-in step — remember preference carried over from step 1. */
  const verifyLoginOtp = async (otpToken, code, remember = true) => {
    const data = await verifyLoginOtpApi({ otpToken, code })
    return startSession(data, remember)
  }

  const register = async (name, email, password, confirmPassword) => {
    const data = await registerUser({ name, email, password, confirmPassword })
    // Registration always persists — the user just created an account.
    return startSession(data, true)
  }

  const logout = async () => {
    await logoutUser()
    clearStorage()
    setUser(null)
    setToken(null)
  }

  const updateUser = (nextUser) => {
    setUser(nextUser)
    // Preserve whichever storage the session currently lives in.
    const persist = Boolean(localStorage.getItem('token'))
    writeStorage('user', JSON.stringify(nextUser), persist)
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, verifyLoginOtp, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}
