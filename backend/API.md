# Banking API

All routes below need `Authorization: Bearer <token>` (from `/api/auth/login`).

## Money rules

- Every amount is an **integer in minor units** (paise or cents): `25050` means 250.50. Never send decimals.
- Request field is `amountMinor`; balances and transaction amounts come back in minor units too.
- Transaction `amount` is signed: credits are positive, debits are negative.
- Money-moving requests accept an optional `Idempotency-Key` header (8-128 characters). Retrying with the same key returns the original result (`200`, `replayed: true`) instead of moving money twice. Reusing a key for a different request returns `409`.
- Debit, credit and ledger rows are written in one database transaction, so the database must be a replica set (MongoDB Atlas is).

## Endpoints

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/api/accounts` | any signed-in user | Your accounts |
| POST | `/api/accounts` | any signed-in user | Open an account. Body: `{ "type": "savings" \| "current" \| "fixed_deposit" }`. Max 5 open accounts. |
| GET | `/api/accounts/:id` | owner, staff, admin | One account |
| POST | `/api/accounts/:id/deposit` | owner, staff, admin | Body: `{ "amountMinor": 100000, "description": "Salary" }`. Customers can deposit only if `ALLOW_CUSTOMER_DEPOSITS` is not `false` (simulated top-up until there is a payment gateway). |
| POST | `/api/accounts/:id/withdraw` | staff, admin | Counter withdrawal. `422` if funds are insufficient. |
| POST | `/api/transfers` | any signed-in user | Body: `{ "fromAccountId": "...", "toAccountNumber": "123456789012", "amountMinor": 25000, "description": "Rent" }` |
| GET | `/api/transactions` | any signed-in user | Your ledger, newest first. Query: `page`, `limit` (max 100), `accountId`, `type`, `status`, `from`, `to` |
| GET | `/api/dashboard/summary` | any signed-in user | Totals, accounts, 6-month cash flow, 7-day balance trend and recent transactions in one call |

Transfers between a customer's own accounts are marked `isInternal` and are left out of money in / money out on the dashboard.

## Setup notes

- New env vars (see `.env.example`): `DEFAULT_CURRENCY`, `APP_TIMEZONE`, `ALLOW_CUSTOMER_DEPOSITS`.
- Create the first admin with `npm run seed:admin` (reads `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` from `.env`).
- `npm test` runs the auth tests, the helper unit tests and the banking tests. The banking tests write real data (they clean up after themselves), so point `MONGODB_URI` at a test database.
