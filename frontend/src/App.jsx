import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/authStore'
import { ConsentProvider } from './context/ConsentContext'
import { ThemeProvider } from './context/ThemeContext'
import CookieConsent from './components/CookieConsent'
import ProtectedRoute from './components/ProtectedRoute'

// Eagerly loaded for instant first paint
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'

// Code-split / lazy loaded routes (downloaded only when accessed)
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Apply = lazy(() => import('./pages/Apply'))
const FixedDeposits = lazy(() => import('./pages/FixedDeposits'))
const Staff = lazy(() => import('./pages/Staff'))
const Admin = lazy(() => import('./pages/Admin'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Transfers = lazy(() => import('./pages/Transfers'))
const DebitCards = lazy(() => import('./pages/DebitCards'))
const CreditCards = lazy(() => import('./pages/CreditCards'))
const CreditCardApplication = lazy(() => import('./pages/CreditCardApplication'))
const Deposits = lazy(() => import('./pages/Deposits'))
const StaffCards = lazy(() => import('./pages/StaffCards'))
const Settings = lazy(() => import('./pages/Settings'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

const PageLoader = () => (
  <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
    <div className="db-loading" style={{ margin: 0 }}>Loading workspace…</div>
  </div>
)

function PublicOnlyRoute({ children }) {
  const { user, token, loading } = useAuth()
  if (!loading && (user || token)) {
    if (user?.role === 'admin') return <Navigate to="/admin" replace />
    if (user?.role === 'staff') return <Navigate to="/staff" replace />
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function RoleSmartDashboard() {
  const { user } = useAuth()
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'staff') return <Navigate to="/staff" replace />
  return <Dashboard />
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
      <Route path="/reset-password/:token" element={<PublicOnlyRoute><ResetPassword /></PublicOnlyRoute>} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnlyRoute>
            <Signup />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <RoleSmartDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts"
        element={
          <ProtectedRoute>
            <Accounts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/apply"
        element={
          <ProtectedRoute>
            <Apply />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fixed-deposits"
        element={
          <ProtectedRoute>
            <FixedDeposits />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={['staff', 'admin']}>
            <Staff />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <Transactions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transfers"
        element={
          <ProtectedRoute>
            <Transfers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cards/debit"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <DebitCards />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cards/credit"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CreditCards />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cards/credit/apply"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CreditCardApplication />
          </ProtectedRoute>
        }
      />
      <Route
        path="/deposits"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <Deposits />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/card-desk"
        element={
          <ProtectedRoute allowedRoles={['staff', 'admin']}>
            <StaffCards />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <ConsentProvider>
      <ThemeProvider>
        <AuthProvider>
          <CookieConsent />
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </ConsentProvider>
  )
}
