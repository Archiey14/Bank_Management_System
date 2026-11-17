import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell, { PageHeader } from '../components/AppShell'
import { useAuth } from '../context/authStore'
import {
  createAdminUser,
  getAdminReports,
  listAdminAuditLogs,
  listAdminUsers,
  updateAdminUser,
} from '../services/api'
import { formatMinor } from '../utils/money'
import { formatDate, formatDateTime } from '../utils/format'
import PasswordField from '../components/PasswordField'

const ROLES_LIST = ['customer', 'staff', 'admin']

export default function Admin() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('users') // 'users' | 'audit' | 'reports'

  // Reports state
  const [reports, setReports] = useState(null)
  const [loadingReports, setLoadingReports] = useState(true)

  // Users state
  const [users, setUsers] = useState([])
  const [userTotal, setUserTotal] = useState(0)
  const [userPage, setUserPage] = useState(1)
  const [userSearch, setUserSearch] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userStatus, setUserStatus] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)

  // New staff modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'staff' })
  const [creatingStaff, setCreatingStaff] = useState(false)
  const [modalError, setModalError] = useState('')

  // Audit logs state
  const [logs, setLogs] = useState([])
  const [logTotal, setLogTotal] = useState(0)
  const [logPage, setLogPage] = useState(1)
  const [logAction, setLogAction] = useState('')
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Global notice/error
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  // Load telemetry
  const loadReports = async () => {
    try {
      setLoadingReports(true)
      const data = await getAdminReports()
      setReports(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load system reports.')
    } finally {
      setLoadingReports(false)
    }
  }

  // Load users
  const loadUsers = async (page = 1) => {
    try {
      setLoadingUsers(true)
      const data = await listAdminUsers({
        page,
        limit: 15,
        q: userSearch,
        role: userRole,
        status: userStatus,
      })
      setUsers(data.users)
      setUserTotal(data.total)
      setUserPage(page)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load user directory.')
    } finally {
      setLoadingUsers(false)
    }
  }

  // Load audit logs
  const loadLogs = async (page = 1) => {
    try {
      setLoadingLogs(true)
      const data = await listAdminAuditLogs({
        page,
        limit: 20,
        action: logAction,
      })
      setLogs(data.logs)
      setLogTotal(data.total)
      setLogPage(page)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load audit logs.')
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    loadReports()
    loadUsers(1)
    loadLogs(1)
  }, [])

  // Create Staff
  const handleCreateStaff = async (e) => {
    e.preventDefault()
    setModalError('')
    if (!newStaff.name.trim() || newStaff.name.trim().length < 2) {
      return setModalError('Full name must be at least 2 characters.')
    }
    if (!/^\S+@\S+\.\S+$/.test(newStaff.email)) {
      return setModalError('Enter a valid email address.')
    }
    if (newStaff.password.length < 6) {
      return setModalError('Password must be at least 6 characters.')
    }

    try {
      setCreatingStaff(true)
      await createAdminUser(newStaff)
      setNotice(`New ${newStaff.role} account created for ${newStaff.email}`)
      setModalOpen(false)
      setNewStaff({ name: '', email: '', password: '', role: 'staff' })
      loadUsers(1)
      loadReports()
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to create staff account.')
    } finally {
      setCreatingStaff(false)
    }
  }

  // Toggle user active status
  const handleToggleStatus = async (targetUser) => {
    setError('')
    setNotice('')
    try {
      await updateAdminUser(targetUser._id, { isActive: !targetUser.isActive })
      setNotice(`${targetUser.name} is now ${!targetUser.isActive ? 'active' : 'deactivated'}.`)
      loadUsers(userPage)
      loadReports()
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update user status.')
    }
  }

  // Change role
  const handleChangeRole = async (targetUser, newRole) => {
    if (targetUser.role === newRole) return
    setError('')
    setNotice('')
    try {
      await updateAdminUser(targetUser._id, { role: newRole })
      setNotice(`Updated ${targetUser.name}'s role to ${newRole}.`)
      loadUsers(userPage)
      loadReports()
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change user role.')
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Administration Portal"
        title="System Governance"
        sub="Manage staff accounts, assign roles, view compliance audit logs and review platform telemetry."
        actions={
          <button
            type="button"
            className="db-btn db-btn--primary"
            onClick={() => {
              setModalError('')
              setModalOpen(true)
            }}
          >
            + Add Staff Member
          </button>
        }
      />

      {notice && (
        <div className="db-alert db-alert--success" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="db-alert db-alert--error" role="alert">
          {error}
        </div>
      )}

      {/* Top telemetry cards */}
      {reports && (
        <div className="db-stats" style={{ marginTop: 20 }}>
          <div className="db-stat">
            <div className="db-stat__num">{reports.users.total}</div>
            <div className="db-stat__cap">
              Total Users · {reports.users.staff} staff · {reports.users.admins} admins
            </div>
          </div>
          <div className="db-stat">
            <div className="db-stat__num">{reports.accounts.total}</div>
            <div className="db-stat__cap">
              Total Accounts · {reports.accounts.active} active
            </div>
          </div>
          <div className="db-stat">
            <div className="db-stat__num">{formatMinor(reports.accounts.totalBalanceMinor)}</div>
            <div className="db-stat__cap">Total Bank Reserves</div>
          </div>
          <div className="db-stat">
            <div className="db-stat__num">{reports.transactions.total}</div>
            <div className="db-stat__cap">
              Ledger Transactions · {reports.transactions.pendingFlagged} flagged
            </div>
          </div>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="db-tab-bar" role="tablist" aria-label="Admin sections">
        <button
          type="button"
          className={`db-chiptab${activeTab === 'users' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Staff &amp; User Directory ({userTotal})
        </button>
        <button
          type="button"
          className={`db-chiptab${activeTab === 'audit' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Audit Logs ({logTotal})
        </button>
      </div>

      {/* Tab 1: Users & Staff */}
      {activeTab === 'users' && (
        <section className="db-card" style={{ marginTop: 20 }}>
          <div className="db-card__head">
            <div>
              <h2 className="db-card__title">User &amp; Staff Management</h2>
              <p className="db-card__sub">
                Administer employee credentials, role permissions, and access states.
              </p>
            </div>
          </div>

          <form
            className="db-filters"
            onSubmit={(e) => {
              e.preventDefault()
              loadUsers(1)
            }}
          >
            <div className="field db-filters__wide">
              <label htmlFor="user-search">Search Name or Email</label>
              <input
                id="user-search"
                className="input"
                placeholder="Search by name or email"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="user-role">Role</label>
              <select
                id="user-role"
                className="input db-select"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="customer">Customer</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="user-status">Status</label>
              <select
                id="user-status"
                className="input db-select"
                value={userStatus}
                onChange={(e) => setUserStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="db-filters__actions">
              <button type="submit" className="db-btn db-btn--primary">
                Filter
              </button>
            </div>
          </form>

          {loadingUsers ? (
            <div className="db-loading">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty__title">No users found</div>
              <p className="db-empty__text">Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u._id === user?._id
                    return (
                      <tr key={u._id}>
                        <td>
                          <div className="db-table__title">{u.name}</div>
                          <div className="db-table__sub">{u.email}</div>
                        </td>
                        <td>
                          {isSelf ? (
                            <span className="pill pill--completed">{u.role}</span>
                          ) : (
                            <select
                              className="input db-select"
                              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                              value={u.role}
                              onChange={(e) => handleChangeRole(u, e.target.value)}
                            >
                              {ROLES_LIST.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>
                          <span className={`pill ${u.isActive ? 'pill--active' : 'pill--frozen'}`}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>{formatDate(u.createdAt)}</td>
                        <td>
                          {!isSelf && (
                            <button
                              type="button"
                              className="db-btn db-btn--outline"
                              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                              onClick={() => handleToggleStatus(u)}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Audit Logs */}
      {activeTab === 'audit' && (
        <section className="db-card" style={{ marginTop: 20 }}>
          <div className="db-card__head">
            <div>
              <h2 className="db-card__title">Security &amp; Compliance Audit Trail</h2>
              <p className="db-card__sub">
                Immutable chronological log of privileged administrative and banking actions.
              </p>
            </div>
          </div>

          <form
            className="db-filters"
            onSubmit={(e) => {
              e.preventDefault()
              loadLogs(1)
            }}
          >
            <div className="field db-filters__wide">
              <label htmlFor="log-action">Filter Action Name</label>
              <input
                id="log-action"
                className="input"
                placeholder="e.g. user.create, account.freeze, transfer.review"
                value={logAction}
                onChange={(e) => setLogAction(e.target.value)}
              />
            </div>
            <div className="db-filters__actions">
              <button type="submit" className="db-btn db-btn--primary">
                Search Logs
              </button>
            </div>
          </form>

          {loadingLogs ? (
            <div className="db-loading">Loading audit records…</div>
          ) : logs.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty__title">No audit records found</div>
              <p className="db-empty__text">System operations will be recorded here.</p>
            </div>
          ) : (
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Summary</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(log.createdAt)}</td>
                      <td>
                        <div className="db-table__title">{log.actor?.name || 'System'}</div>
                        <div className="db-table__sub">
                          {log.actor?.email || '—'} ({log.actorRole || log.actor?.role})
                        </div>
                      </td>
                      <td>
                        <span className="pill pill--pending" style={{ fontFamily: 'monospace' }}>
                          {log.action}
                        </span>
                      </td>
                      <td>{log.summary || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {log.ip || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Modal: Add Staff Member */}
      {modalOpen && (
        <div className="cookie-modal-backdrop" role="dialog" aria-modal="true">
          <div className="cookie-modal" style={{ maxWidth: 520 }}>
            <div className="cookie-modal__head">
              <div>
                <h3 className="cookie-modal__title">Create Staff Account</h3>
                <p className="cookie-modal__sub">
                  Grant operational access to a bank employee.
                </p>
              </div>
              <button
                type="button"
                className="cookie-modal__close"
                onClick={() => setModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="db-form">
              {modalError && (
                <div className="db-alert db-alert--error" role="alert">
                  {modalError}
                </div>
              )}

              <div className="field">
                <label htmlFor="staff-name">Full Name</label>
                <input
                  id="staff-name"
                  className="input"
                  required
                  placeholder="Employee's full name"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="staff-email">Work Email</label>
                <input
                  id="staff-email"
                  type="email"
                  className="input"
                  required
                  placeholder="employee@northbank.com"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="staff-password">Initial Password</label>
                <PasswordField
                  id="staff-password"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  placeholder="Temporary password"
                />
              </div>

              <div className="field">
                <label htmlFor="staff-role">Role</label>
                <select
                  id="staff-role"
                  className="input db-select"
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                >
                  <option value="staff">Staff (Operations &amp; Customer Desk)</option>
                  <option value="admin">Admin (Full System Governance)</option>
                </select>
              </div>

              <div className="db-form__actions" style={{ marginTop: 20 }}>
                <button
                  type="submit"
                  className="db-btn db-btn--primary"
                  disabled={creatingStaff}
                >
                  {creatingStaff ? 'Creating…' : 'Create Account'}
                </button>
                <button
                  type="button"
                  className="db-btn db-btn--outline"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}

