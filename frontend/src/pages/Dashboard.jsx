import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './dashboard.css'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="dash-container">
      <header className="dash-header">
        <div className="dash-brand">
          <div className="dash-logo">NB</div>
          <div>
            <h1 className="dash-title">Northbank</h1>
            <span className="dash-subtitle">Workspace Portal</span>
          </div>
        </div>

        <div className="dash-user-controls">
          <div className="dash-user-badge">
            <span className="dash-user-role">{user?.role || 'Customer'}</span>
            <span className="dash-user-name">{user?.name}</span>
          </div>
          <button onClick={handleLogout} className="dash-btn-logout">
            Sign out
          </button>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-welcome">
          <h2>Welcome back, {user?.name || 'User'}</h2>
          <p>Here is your current Northbank workspace overview.</p>
        </div>

        <div className="dash-grid">
          <div className="dash-card">
            <div className="dash-card-header">
              <span className="dash-card-label">Profile Status</span>
              <span className="dash-status-pill">{user?.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="dash-card-body">
              <p><strong>Email:</strong> {user?.email}</p>
              <p><strong>Role:</strong> {user?.role}</p>
              <p><strong>Last Login:</strong> {user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Just now'}</p>
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-header">
              <span className="dash-card-label">Primary Account</span>
              <span className="dash-tag">Savings</span>
            </div>
            <div className="dash-card-body">
              <div className="dash-balance">$14,250.00</div>
              <p className="dash-account-num">Account •••• 8492</p>
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-header">
              <span className="dash-card-label">Quick Actions</span>
            </div>
            <div className="dash-card-actions">
              <button className="dash-action-btn" onClick={() => alert('Account Management module coming up next!')}>
                Manage Accounts
              </button>
              <button className="dash-action-btn" onClick={() => alert('Transfer module coming up next!')}>
                Transfer Funds
              </button>
              <button className="dash-action-btn" onClick={() => alert('Statements module coming up next!')}>
                View Statements
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

