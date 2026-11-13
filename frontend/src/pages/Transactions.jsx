import { useEffect, useState } from 'react'
import AppShell, { PageHeader } from '../components/AppShell'
import { listAccounts, listTransactions } from '../services/api'
import { formatMinor } from '../utils/money'
import {
  ACCOUNT_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
  formatDateTime,
  maskAccount,
} from '../utils/format'

const EMPTY_FILTERS = {
  accountId: '',
  type: '',
  status: '',
  from: '',
  to: '',
  limit: '20',
}

const TYPE_OPTIONS = ['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'bill_payment']
const STATUS_OPTIONS = ['completed', 'pending', 'failed']

const toStartOfDay = (value) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined)
const toEndOfDay = (value) => (value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined)

export default function Transactions() {
  const [accounts, setAccounts] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [applied, setApplied] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listAccounts()
      .then((result) => {
        if (active) setAccounts(result.accounts)
      })
      .catch(() => {
        if (active) setAccounts([])
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    listTransactions({
      page,
      limit: applied.limit,
      accountId: applied.accountId,
      type: applied.type,
      status: applied.status,
      from: toStartOfDay(applied.from),
      to: toEndOfDay(applied.to),
    })
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || 'Could not load your transactions.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [applied, page])

  const accountsById = new Map(accounts.map((account) => [account._id, account]))
  const transactions = data?.transactions ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, data?.totalPages || 1)

  const updateFilter = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }))
  }

  const applyFilters = (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setPage(1)
    setApplied({ ...filters })
  }

  const resetFilters = () => {
    setLoading(true)
    setError('')
    setFilters(EMPTY_FILTERS)
    setApplied({ ...EMPTY_FILTERS })
    setPage(1)
  }

  const goToPage = (nextPage) => {
    setLoading(true)
    setError('')
    setPage(nextPage)
  }

  const retry = () => {
    setLoading(true)
    setError('')
    setApplied({ ...applied })
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Your ledger"
        title="Transactions"
        sub="Every movement across your accounts, newest first."
      />

      <section className="db-card" style={{ marginTop: 20 }}>
        <form className="db-filters" onSubmit={applyFilters}>
          <div className="field db-filters__wide">
            <label htmlFor="filter-account">Account</label>
            <select
              id="filter-account"
              className="input db-select"
              value={filters.accountId}
              onChange={updateFilter('accountId')}
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account._id} value={account._id}>
                  {ACCOUNT_TYPE_LABELS[account.type]} {maskAccount(account.accountNumber)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filter-type">Type</label>
            <select
              id="filter-type"
              className="input db-select"
              value={filters.type}
              onChange={updateFilter('type')}
            >
              <option value="">Any type</option>
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {TRANSACTION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              className="input db-select"
              value={filters.status}
              onChange={updateFilter('status')}
            >
              <option value="">Any status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filter-from">From</label>
            <input
              id="filter-from"
              className="input"
              type="date"
              value={filters.from}
              onChange={updateFilter('from')}
            />
          </div>

          <div className="field">
            <label htmlFor="filter-to">To</label>
            <input
              id="filter-to"
              className="input"
              type="date"
              value={filters.to}
              onChange={updateFilter('to')}
            />
          </div>

          <div className="db-filters__actions">
            <span className="db-filters__count">
              {loading ? 'Loading…' : `${total} transaction${total === 1 ? '' : 's'} found`}
            </span>

            <label className="db-filters__limit">
              <span>Rows</span>
              <select
                className="input db-select"
                value={filters.limit}
                onChange={updateFilter('limit')}
                aria-label="Rows per page"
              >
                {['10', '20', '50', '100'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" className="db-btn db-btn--outline" onClick={resetFilters}>
              Reset
            </button>
            <button type="submit" className="db-btn db-btn--primary">
              Apply filters
            </button>
          </div>
        </form>
      </section>

      {error && (
        <>
          <div className="db-alert db-alert--error" role="alert">
            {error}
          </div>
          <div className="db-form__actions" style={{ marginTop: 16 }}>
            <button type="button" className="db-btn db-btn--outline" onClick={retry}>
              Try again
            </button>
          </div>
        </>
      )}

      {loading && <div className="db-loading">Loading transactions…</div>}

      {!loading && !error && transactions.length === 0 && (
        <div className="db-empty">
          <div className="db-empty__title">No transactions match</div>
          <p className="db-empty__text">
            Once money moves in or out of your accounts, it will appear here. Try clearing the
            filters if you expected results.
          </p>
          <button type="button" className="db-btn db-btn--outline" onClick={resetFilters}>
            Clear filters
          </button>
        </div>
      )}

      {!loading && !error && transactions.length > 0 && (
        <>
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Account</th>
                  <th className="num">Amount</th>
                  <th className="num">Balance after</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => {
                  const account = accountsById.get(transaction.account)
                  const credit = transaction.amount > 0
                  return (
                    <tr key={transaction._id}>
                      <td>{formatDateTime(transaction.createdAt)}</td>
                      <td>
                        <div className="db-table__title">
                          {transaction.description ||
                            TRANSACTION_TYPE_LABELS[transaction.type] ||
                            'Transaction'}
                        </div>
                        {transaction.counterpartyAccountNumber && (
                          <div className="db-table__sub">
                            Counterparty {maskAccount(transaction.counterpartyAccountNumber)}
                          </div>
                        )}
                      </td>
                      <td>{TRANSACTION_TYPE_LABELS[transaction.type] || transaction.type}</td>
                      <td>{account ? maskAccount(account.accountNumber) : '—'}</td>
                      <td className={`num ${credit ? 'is-in' : 'is-out'}`}>
                        {credit ? '+' : '−'}
                        {formatMinor(Math.abs(transaction.amount))}
                      </td>
                      <td className="num">{formatMinor(transaction.balanceAfter)}</td>
                      <td>
                        <span className={`pill pill--${transaction.status}`}>
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="db-pager">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="db-pager__actions">
              <button
                type="button"
                className="db-btn db-btn--outline"
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                className="db-btn db-btn--outline"
                onClick={() => goToPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
