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

const TYPE_OPTIONS = [
  'deposit',
  'withdrawal',
  'transfer_in',
  'transfer_out',
  'bill_payment',
  'fd_booking',
  'fd_credit',
]
const STATUS_OPTIONS = ['completed', 'pending', 'failed']

const toStartOfDay = (value) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined)
const toEndOfDay = (value) => (value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined)

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

const buildStatementCsv = (transactions, accountsById, generatedAt) => {
  const lines = [
    csvCell('Northbank — Account Statement'),
    csvCell(`Generated: ${generatedAt}`),
    csvCell(''),
    [
      'Date',
      'Description',
      'Type',
      'Account',
      'Amount (INR)',
      'Balance after (INR)',
      'Status',
    ]
      .map(csvCell)
      .join(','),
  ]
  transactions.forEach((transaction) => {
    const account = accountsById.get(transaction.account)
    lines.push(
      [
        formatDateTime(transaction.createdAt),
        transaction.description || TRANSACTION_TYPE_LABELS[transaction.type] || 'Transaction',
        TRANSACTION_TYPE_LABELS[transaction.type] || transaction.type,
        account ? maskAccount(account.accountNumber) : '—',
        (transaction.amount / 100).toFixed(2),
        (transaction.balanceAfter / 100).toFixed(2),
        transaction.status,
      ]
        .map(csvCell)
        .join(',')
    )
  })
  return lines.join('\r\n')
}

export default function Transactions() {
  const [accounts, setAccounts] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [applied, setApplied] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTx, setSelectedTx] = useState(null)

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

  const visibleCredits = transactions.reduce((sum, t) => (t.amount > 0 ? sum + t.amount : sum), 0)
  const visibleDebits = transactions.reduce((sum, t) => (t.amount < 0 ? sum - t.amount : sum), 0)

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

  const [statementBusy, setStatementBusy] = useState(false)

  const handleStatement = async () => {
    setStatementBusy(true)
    setError('')
    try {
      const baseParams = {
        limit: 100,
        accountId: applied.accountId,
        type: applied.type,
        status: applied.status,
        from: toStartOfDay(applied.from),
        to: toEndOfDay(applied.to),
      }
      const first = await listTransactions({ ...baseParams, page: 1 })
      const pages = Math.min(first.totalPages || 1, 20)
      const rows = [...first.transactions]
      for (let nextPage = 2; nextPage <= pages; nextPage += 1) {
        const result = await listTransactions({ ...baseParams, page: nextPage })
        rows.push(...result.transactions)
      }

      const generatedAt = new Date().toLocaleString('en-US')
      const csv = buildStatementCsv(rows, accountsById, generatedAt)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `northbank-statement-${new Date().toISOString().slice(0, 10)}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate the statement.')
    } finally {
      setStatementBusy(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Your ledger"
        title="Transactions"
        sub="Every movement across your accounts, newest first."
        actions={
          <button
            type="button"
            className="db-btn db-btn--outline"
            onClick={handleStatement}
            disabled={statementBusy}
          >
            {statementBusy ? 'Preparing…' : 'Statement (CSV)'}
          </button>
        }
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
        <div className="db-stats" style={{ marginTop: 20 }}>
          <div className="db-stat">
            <div className="db-stat__num" style={{ color: 'var(--green)' }}>
              +{formatMinor(visibleCredits)}
            </div>
            <div className="db-stat__cap">Money in · visible rows</div>
          </div>
          <div className="db-stat">
            <div className="db-stat__num" style={{ color: 'var(--danger)' }}>
              −{formatMinor(visibleDebits)}
            </div>
            <div className="db-stat__cap">Money out · visible rows</div>
          </div>
          <div className="db-stat">
            <div className="db-stat__num">{total}</div>
            <div className="db-stat__cap">Transactions match the filters</div>
          </div>
          <div className="db-stat">
            <div className="db-stat__num">{transactions.length}</div>
            <div className="db-stat__cap">Rows on this page</div>
          </div>
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
                    <tr
                      key={transaction._id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedTx(transaction)}
                      title="Click to view transaction details"
                    >
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

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="cookie-modal-backdrop" role="dialog" aria-modal="true">
          <div className="cookie-modal" style={{ maxWidth: 540 }}>
            <div className="cookie-modal__head">
              <div>
                <h3 className="cookie-modal__title">Transaction Receipt</h3>
                <p className="cookie-modal__sub">
                  Immutable record from the Northbank ledger.
                </p>
              </div>
              <button
                type="button"
                className="cookie-modal__close"
                onClick={() => setSelectedTx(null)}
              >
                &times;
              </button>
            </div>

            <dl className="db-kv">
              <div>
                <dt>Transaction ID</dt>
                <dd style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                  {selectedTx._id}
                </dd>
              </div>
              <div>
                <dt>Timestamp</dt>
                <dd>{formatDateTime(selectedTx.createdAt)}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{TRANSACTION_TYPE_LABELS[selectedTx.type] || selectedTx.type}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: selectedTx.amount > 0 ? 'var(--green)' : 'var(--danger)',
                  }}
                >
                  {selectedTx.amount > 0 ? '+' : '−'}
                  {formatMinor(Math.abs(selectedTx.amount))}
                </dd>
              </div>
              <div>
                <dt>Balance After</dt>
                <dd style={{ fontWeight: 700 }}>{formatMinor(selectedTx.balanceAfter)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`pill pill--${selectedTx.status}`}>
                    {selectedTx.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>
                  {accountsById.get(selectedTx.account)
                    ? maskAccount(accountsById.get(selectedTx.account).accountNumber)
                    : selectedTx.account}
                </dd>
              </div>
              {selectedTx.counterpartyAccountNumber && (
                <div>
                  <dt>Counterparty Account</dt>
                  <dd style={{ fontFamily: 'monospace' }}>
                    {maskAccount(selectedTx.counterpartyAccountNumber)}
                  </dd>
                </div>
              )}
              {selectedTx.transferId && (
                <div>
                  <dt>Transfer Reference</dt>
                  <dd style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {selectedTx.transferId}
                  </dd>
                </div>
              )}
              {selectedTx.description && (
                <div>
                  <dt>Description</dt>
                  <dd>{selectedTx.description}</dd>
                </div>
              )}
            </dl>

            <div className="db-form__actions" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="db-btn db-btn--primary"
                onClick={() => setSelectedTx(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
