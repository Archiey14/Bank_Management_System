import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/authStore'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, token, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'inherit' }}>
        <p>Loading session...</p>
      </div>
    )
  }

  if (!user && !token) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to the appropriate home base for their role
    if (user.role === 'admin') return <Navigate to="/admin" replace />
    if (user.role === 'staff') return <Navigate to="/staff" replace />
    return <Navigate to="/dashboard" replace />
  }

  return children
}
