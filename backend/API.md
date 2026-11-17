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
| PATCH | `/api/auth/me` | any signed-in user | Update your display name. Body: `{ "name": "Ada Lovelace" }` |
| PATCH | `/api/auth/password` | any signed-in user | Change your password. Body: `{ "currentPassword": "...", "newPassword": "...", "confirmPassword": "..." }` |
| POST | `/api/auth/otp/verify` | public (needs `otpToken`) | Second step of sign-in. Body: `{ "otpToken", "code" }` where `code` is the 6-digit one-time code emailed upon login. Returns `{ user, token }`. |
| GET | `/api/accounts` | any signed-in user | Your accounts |
| POST | `/api/accounts` | any signed-in user | Open an account. Body: `{ "type": "savings" \| "current" \| "fixed_deposit" }`. Max 5 open accounts. |
| GET | `/api/accounts/:id` | owner, staff, admin | One account |
| POST | `/api/accounts/:id/deposit` | owner, staff, admin | Body: `{ "amountMinor": 100000, "description": "Salary" }`. Customers can deposit only if `ALLOW_CUSTOMER_DEPOSITS` is not `false` (simulated top-up until there is a payment gateway). |
| POST | `/api/accounts/:id/withdraw` | staff, admin | Counter withdrawal. `422` if funds are insufficient. |
| POST | `/api/transfers` | any signed-in user | Body: `{ "fromAccountId": "...", "toAccountNumber": "123456789012", "amountMinor": 25000, "description": "Rent" }` |
| GET | `/api/transactions` | any signed-in user | Your ledger, newest first. Query: `page`, `limit` (max 100), `accountId`, `type`, `status`, `from`, `to` |
| GET | `/api/dashboard/summary` | any signed-in user | Totals, accounts, 6-month cash flow, 7-day balance trend and recent transactions in one call |
| POST | `/api/applications` | any signed-in user | Apply to open an account with full KYC details. Body: `{ "accountType", "dob", "phone", "pan", "address": { "line1", "city", "state", "pincode" }, "occupation", "annualIncome", "nomineeName"?, "nomineeRelation"?, "initialDepositMinor"? }`. One pending application at a time. |
| GET | `/api/applications/mine` | any signed-in user | Your account applications and their status. |
| GET | `/api/applications` | staff, admin | Review queue. Query: `status`, `q` (name, email or application number), `limit`. |
| PATCH | `/api/applications/:id/approve` | staff, admin | Opens the account and credits `initialDepositMinor`. |
| PATCH | `/api/applications/:id/reject` | staff, admin | Body: `{ "remarks" }` (required, shown to the customer). |
| GET | `/api/beneficiaries` | any signed-in user | Your saved payees. |
| POST | `/api/beneficiaries` | any signed-in user | Body: `{ "name", "accountNumber" (12 digits), "nickname"? }`. The number must exist at this bank. |
| DELETE | `/api/beneficiaries/:id` | any signed-in user | Remove a payee. |
| GET | `/api/fixed-deposits` | any signed-in user | Your term deposits, each with a live payout `preview` while active. |
| POST | `/api/fixed-deposits` | any signed-in user | Body: `{ "sourceAccountId", "principalMinor", "tenureMonths": 6\|12\|24\|36 }`. Min ₹10,000; rates 5.5–7.5% p.a. simple interest. Accepts `Idempotency-Key`. |
| POST | `/api/fixed-deposits/:id/settle` | any signed-in user | Pays out: maturity amount, or principal + pro-rata interest − 1% penalty on early break. |
| GET | `/api/staff/overview` | staff, admin | Bank telemetry: customers, open accounts, total balances, daily volume by type and day, pending application count and queue. |
| GET | `/api/staff/accounts` | staff, admin | Customer directory (max 100, newest first, populated with owner name/email). Query: `status`, `q` (account number). |
| PATCH | `/api/accounts/:id/status` | staff, admin | Freeze or unfreeze. Body: `{ "status": "active" \| "frozen" }`. Frozen accounts cannot send money. |

Transfers between a customer's own accounts are marked `isInternal` and are left out of money in / money out on the dashboard.

## Email-OTP Two-Step Verification

All accounts are secured with always-on Email-OTP two-step verification.

1. `POST /api/auth/login` with valid email & password generates a random 6-digit one-time code, dispatches it to the user's registered email address via Nodemailer, stores its SHA-256 hash in MongoDB with a 5-minute expiry, and returns `{ message, otpRequired: true, otpToken }`. The short-lived `otpToken` has `purpose: 'otp-login'` and is rejected by all session-authenticated routes.
2. `POST /api/auth/otp/verify` with `{ otpToken, code }` verifies the 6-digit code against the SHA-256 hash using constant-time comparison, invalidates the code immediately (single-use), and issues the session JWT and user profile.
3. Five failed attempts lock verification for 15 minutes.

## Setup notes

- New env vars (see `.env.example`): `DEFAULT_CURRENCY`, `APP_TIMEZONE`, `ALLOW_CUSTOMER_DEPOSITS`.
- Create the first admin with `npm run seed:admin` (reads `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` from `.env`).
- `npm test` runs the auth tests, the helper unit tests and the banking tests. The banking tests write real data (they clean up after themselves), so point `MONGODB_URI` at a test database.
