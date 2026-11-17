// Central place for banking rules.
// Money is always stored as an integer in minor units (paise/cents), never as a float.

const CURRENCY = (process.env.DEFAULT_CURRENCY || "INR").toUpperCase();
const TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

const ACCOUNT_TYPES = ["savings", "current", "fixed_deposit"];
const ACCOUNT_STATUSES = ["active", "frozen", "closed"];
const TRANSACTION_TYPES = [
  "deposit",
  "withdrawal",
  "transfer_in",
  "transfer_out",
  "bill_payment",
  "fd_booking",
  "fd_credit",
];
const TRANSACTION_STATUSES = ["completed", "pending", "failed"];

const APPLICATION_STATUSES = ["pending", "approved", "rejected"];
const OCCUPATIONS = [
  "Salaried",
  "Self-employed",
  "Business owner",
  "Student",
  "Retired",
  "Homemaker",
  "Other",
];
const INCOME_BANDS = ["below_2l", "2l_to_5l", "5l_to_10l", "10l_to_25l", "above_25l"];

// Fixed deposits: simple interest, tiered annual rate by tenure.
const FD_TENURES_MONTHS = [6, 12, 24, 36];
const FD_RATES_PERCENT = { 6: 5.5, 12: 6.5, 24: 7.0, 36: 7.5 };
const FD_MIN_AMOUNT_MINOR = 1_000_000; // 10,000.00
// Breaking an FD before maturity costs 1% of the principal off the payout.
const FD_BREAK_PENALTY_RATE = 0.01;

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

// ---- Cards, limits and transfer categories ----
const DEBIT_CARD_STATUSES = ["inactive", "active", "blocked"];
const CREDIT_CARD_STATUSES = ["active", "blocked"];
const CARD_VALIDITY_YEARS = 5;
const MAX_DEBIT_CARDS_PER_ACCOUNT = 2; // live (inactive or active) cards
const DEBIT_ATM_LIMIT_DEFAULT_MINOR = 2_000_000; // 20,000.00 per day
const DEBIT_ATM_LIMIT_MIN_MINOR = 100_000; // 1,000.00
const DEBIT_ATM_LIMIT_MAX_MINOR = 10_000_000; // 1,00,000.00

const CREDIT_LIMIT_MIN_MINOR = 500_000; // 5,000.00
const CREDIT_LIMIT_MAX_MINOR = 50_000_000; // 5,00,000.00
const MAX_CREDIT_CARDS_PER_USER = 3;
const CREDIT_BILLING_DAY = 1; // statement is cut on the 1st of each month
const CREDIT_PAYMENT_WINDOW_DAYS = 20; // days to pay once a balance is owed

// Daily limits reset at 00:00 IST. They are not enforced when NODE_ENV=test.
const DAILY_WITHDRAWAL_LIMIT_MINOR =
  Number.parseInt(process.env.DAILY_WITHDRAWAL_LIMIT_MINOR, 10) || 10_000_000; // 1,00,000.00
const DAILY_TRANSFER_LIMIT_MINOR =
  Number.parseInt(process.env.DAILY_TRANSFER_LIMIT_MINOR, 10) || 10_000_000; // 1,00,000.00
const MAX_CUSTOMER_DEPOSIT_MINOR =
  Number.parseInt(process.env.MAX_CUSTOMER_DEPOSIT_MINOR, 10) || 100_000_000; // 10,00,000.00

const TRANSFER_CATEGORIES = [
  "Direct Transfer",
  "Rent",
  "Bills & Utilities",
  "Family Support",
  "Education",
  "Investment",
  "Other",
];

module.exports = {
  DEBIT_CARD_STATUSES,
  CREDIT_CARD_STATUSES,
  CARD_VALIDITY_YEARS,
  MAX_DEBIT_CARDS_PER_ACCOUNT,
  DEBIT_ATM_LIMIT_DEFAULT_MINOR,
  DEBIT_ATM_LIMIT_MIN_MINOR,
  DEBIT_ATM_LIMIT_MAX_MINOR,
  CREDIT_LIMIT_MIN_MINOR,
  CREDIT_LIMIT_MAX_MINOR,
  MAX_CREDIT_CARDS_PER_USER,
  CREDIT_BILLING_DAY,
  CREDIT_PAYMENT_WINDOW_DAYS,
  DAILY_WITHDRAWAL_LIMIT_MINOR,
  DAILY_TRANSFER_LIMIT_MINOR,
  MAX_CUSTOMER_DEPOSIT_MINOR,
  TRANSFER_CATEGORIES,
  CURRENCY,
  TIMEZONE,
  ACCOUNT_TYPES,
  ACCOUNT_STATUSES,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  APPLICATION_STATUSES,
  OCCUPATIONS,
  INCOME_BANDS,
  FD_TENURES_MONTHS,
  FD_RATES_PERCENT,
  FD_MIN_AMOUNT_MINOR,
  FD_BREAK_PENALTY_RATE,
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
