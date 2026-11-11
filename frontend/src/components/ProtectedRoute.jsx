import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
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

  return children
}

