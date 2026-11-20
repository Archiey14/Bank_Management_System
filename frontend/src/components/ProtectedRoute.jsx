import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/authStore'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, token, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', fontFamily: 'inherit' }}>
        <div className="db-loading" style={{ margin: 0 }}>Validating secure session…</div>
      </div>
    )
  }

  if (!user && !token) {
    // Preserve attempted route so the user returns here seamlessly after sign-in
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to the appropriate home base for their role
    if (user.role === 'admin') return <Navigate to="/admin" replace />
    if (user.role === 'staff') return <Navigate to="/staff" replace />
    return <Navigate to="/dashboard" replace />
  }

  return children
}
