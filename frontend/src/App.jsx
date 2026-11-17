import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/authStore'
import { ConsentProvider } from './context/ConsentContext'
import { ThemeProvider } from './context/ThemeContext'
import CookieConsent from './components/CookieConsent'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Apply from './pages/Apply'
import FixedDeposits from './pages/FixedDeposits'
import Staff from './pages/Staff'
import Admin from './pages/Admin'
import Transactions from './pages/Transactions'
import Transfers from './pages/Transfers'
import DebitCards from './pages/DebitCards'
import CreditCards from './pages/CreditCards'
import CreditCardApplication from './pages/CreditCardApplication'
import Deposits from './pages/Deposits'
import StaffCards from './pages/StaffCards'
import Settings from './pages/Settings'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ProtectedRoute from './components/ProtectedRoute'

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

function AppRoutes() {
  return (
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
