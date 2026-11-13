// Central place for banking rules.
// Money is always stored as an integer in minor units (paise/cents), never as a float.

const CURRENCY = (process.env.DEFAULT_CURRENCY || "INR").toUpperCase();
const TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

const ACCOUNT_TYPES = ["savings", "current", "fixed_deposit"];
const ACCOUNT_STATUSES = ["active", "frozen", "closed"];
const TRANSACTION_TYPES = ["deposit", "withdrawal", "transfer_in", "transfer_out", "bill_payment"];
const TRANSACTION_STATUSES = ["completed", "pending", "failed"];

const ROLES = ["customer", "staff", "admin"];
const STAFF_ROLES = ["staff", "admin"];
const BILLERS = [
  "Electricity",
  "Water",
  "Gas",
  "Mobile recharge",
  "Broadband",
  "Insurance",
  "Credit card",
];

// Transfers to someone else at or above this amount are flagged for staff
// review. Flagging never blocks the transfer; it adds it to the review queue.
const FLAG_TRANSFER_THRESHOLD_MINOR =
  Number.parseInt(process.env.FLAG_TRANSFER_THRESHOLD_MINOR, 10) || 5_000_000; // 50,000.00
const REVIEW_STATUSES = ["none", "pending", "cleared", "escalated"];

const MAX_ACCOUNTS_PER_USER = 5;
const MAX_AMOUNT_MINOR = 1_000_000_000; // 10,000,000.00 per transaction
const MAX_DESCRIPTION_LENGTH = 140;

// Simulated top-ups: lets customers add funds to their own accounts while the
// project has no payment gateway. Set ALLOW_CUSTOMER_DEPOSITS=false to make
// deposits staff-only.
const ALLOW_CUSTOMER_DEPOSITS = process.env.ALLOW_CUSTOMER_DEPOSITS !== "false";

module.exports = {
  CURRENCY,
  TIMEZONE,
  ACCOUNT_TYPES,
  ACCOUNT_STATUSES,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  ROLES,
  STAFF_ROLES,
  BILLERS,
  FLAG_TRANSFER_THRESHOLD_MINOR,
  REVIEW_STATUSES,
  MAX_ACCOUNTS_PER_USER,
  MAX_AMOUNT_MINOR,
  MAX_DESCRIPTION_LENGTH,
  ALLOW_CUSTOMER_DEPOSITS,
};
