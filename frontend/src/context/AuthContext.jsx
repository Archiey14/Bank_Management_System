import { useEffect, useState } from 'react'
import {
  getMe,
  loginUser,
  verifyLoginOtp as verifyLoginOtpApi,
  logoutUser,
  registerUser,
  googleAuthUser,
} from '../services/api'
import { AuthContext } from './authStore'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../config/firebase'

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

// Inspect token expiration before making network calls
const isTokenExpired = (tokenString) => {
  if (!tokenString || typeof tokenString !== 'string') return true
  try {
    const parts = tokenString.split('.')
    if (parts.length < 2) return false
    const payload = JSON.parse(atob(parts[1]))
    if (payload.exp) {
      return payload.exp * 1000 <= Date.now()
    }
    return false
  } catch {
    return false
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = readStorage('user')
      return saved ? JSON.parse(saved) : null
    } catch {
      clearStorage()
      return null
    }
  })
  const [token, setToken] = useState(() => {
    const savedToken = readStorage('token')
    if (isTokenExpired(savedToken)) {
      clearStorage()
      return null
    }
    return savedToken
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = readStorage('token')
      if (savedToken) {
        if (isTokenExpired(savedToken)) {
          clearStorage()
          setUser(null)
          setToken(null)
          setLoading(false)
          return
        }
        try {
          const data = await getMe()
          setUser(data.user)
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

  // 1. Cross-tab session synchronization (sync login/logout across multiple tabs)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        if (!e.newValue) {
          setUser(null)
          setToken(null)
        } else {
          setToken(e.newValue)
          getMe()
            .then((data) => setUser(data.user))
            .catch(() => {
              clearStorage()
              setUser(null)
              setToken(null)
            })
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // 2. Financial session inactivity auto-logout (30 minutes of idle time)
  useEffect(() => {
    if (!token) return

    let idleTimer
    const INACTIVITY_MS = 30 * 60 * 1000

    const resetIdleTimer = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        clearStorage()
        setUser(null)
        setToken(null)
        window.location.href = '/login?expired=inactivity'
      }, INACTIVITY_MS)
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer, { passive: true }))
    resetIdleTimer()

    return () => {
      clearTimeout(idleTimer)
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer))
    }
  }, [token])

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
      return {
        otpRequired: true,
        otpToken: data.otpToken,
        remember,
      }
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

  const signInWithGoogle = async (remember = true) => {
    const result = await signInWithPopup(auth, googleProvider)
    const idToken = await result.user.getIdToken()
    const data = await googleAuthUser({
      idToken,
      email: result.user.email,
      name: result.user.displayName,
      photoURL: result.user.photoURL,
      googleUid: result.user.uid,
    })
    return startSession(data, remember)
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
      value={{
        user,
        token,
        loading,
        login,
        verifyLoginOtp,
        register,
        signInWithGoogle,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
