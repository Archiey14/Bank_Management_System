const User = require("../models/User");
const Account = require("../models/Account");
const AccountApplication = require("../models/AccountApplication");
const Transaction = require("../models/Transaction");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { buildOverview } = require("../utils/reports");
const { clampInt, escapeRegex } = require("../utils/validators");
const { recordAudit } = require("../utils/audit");
const {
  ACCOUNT_TYPES,
  ACCOUNT_STATUSES,
  MAX_ACCOUNTS_PER_USER,
  REVIEW_STATUSES,
} = require("../config/constants");

// GET /api/staff/overview - bank-wide telemetry for the staff dashboard:
// customers, accounts, balances, daily volume and the pending review queue.
const getOverview = asyncHandler(async (req, res) => {
  const days = clampInt(req.query.days, 7, 1, 30);
  const [overview, pendingApplications, recentApplications] = await Promise.all([
    buildOverview(days),
    AccountApplication.countDocuments({ status: "pending" }),
    AccountApplication.find({ status: "pending" })
      .sort({ createdAt: 1 })
      .limit(10)
      .populate("user", "name email"),
  ]);

  res.status(200).json({
    ...overview,
    pendingApplications,
    recentApplications,
  });
});

// GET /api/staff/accounts - every account with its owner, for the customer
// directory behind the freeze/unfreeze controls.
const listAllAccounts = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    if (!ACCOUNT_STATUSES.includes(req.query.status)) {
      throw new AppError(`Status must be one of: ${ACCOUNT_STATUSES.join(", ")}`, 400);
    }
    filter.status = req.query.status;
  }
  if (req.query.q) {
    filter.accountNumber = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
  }
  const accounts = await Account.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("user", "name email");
  res.status(200).json({ accounts });
});

// POST /api/staff/accounts - staff opens an account on behalf of a customer
const openAccountForCustomer = asyncHandler(async (req, res) => {
  const { customerEmail, customerId, type, nickname } = req.body ?? {};

  if (!ACCOUNT_TYPES.includes(type)) {
    throw new AppError(`Account type must be one of: ${ACCOUNT_TYPES.join(", ")}`, 400);
  }

  let customer;
  if (customerEmail) {
    customer = await User.findOne({ email: String(customerEmail).trim().toLowerCase() });
  } else if (customerId) {
    customer = await User.findById(customerId);
  }

  if (!customer) {
    throw new AppError("Customer not found", 404);
  }

  const openCount = await Account.countDocuments({
    user: customer._id,
    status: { $ne: "closed" },
  });
  if (openCount >= MAX_ACCOUNTS_PER_USER) {
    throw new AppError(`Customer already has maximum (${MAX_ACCOUNTS_PER_USER}) open accounts`, 400);
  }

  let account;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      account = await Account.create({
        user: customer._id,
        type,
        nickname: typeof nickname === "string" ? nickname.trim().slice(0, 50) : "",
        accountNumber: Account.generateAccountNumber(),
      });
      break;
    } catch (error) {
      if (error.code === 11000 && attempt < 5) continue;
      throw error;
    }
  }

  await recordAudit({
    actor: req.user,
    action: "account.open_by_staff",
    targetType: "Account",
    targetId: account._id,
    summary: `Opened ${type} account for ${customer.email}`,
    req,
  });

  res.status(201).json({
    message: "Account opened successfully for customer",
    account,
  });
});

// GET /api/staff/flagged-transfers - list flagged transfers for review
const listFlaggedTransfers = asyncHandler(async (req, res) => {
  const filter = { flagged: true };
  if (req.query.status && REVIEW_STATUSES.includes(req.query.status)) {
    filter.reviewStatus = req.query.status;
  }

  const transfers = await Transaction.find(filter)
    .lean()
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("user", "name email")
    .populate("account", "accountNumber")
    .populate("reviewedBy", "name email");

  res.status(200).json({ transfers });
});

// PATCH /api/staff/flagged-transfers/:id/review - staff reviews flagged transfer
const reviewFlaggedTransfer = asyncHandler(async (req, res) => {
  const { reviewStatus, reviewNote } = req.body ?? {};
  if (!["cleared", "escalated"].includes(reviewStatus)) {
    throw new AppError('reviewStatus must be "cleared" or "escalated"', 400);
  }

  const tx = await Transaction.findById(req.params.id);
  if (!tx || !tx.flagged) {
    throw new AppError("Flagged transfer not found", 404);
  }

  tx.reviewStatus = reviewStatus;
  tx.reviewNote = typeof reviewNote === "string" ? reviewNote.trim().slice(0, 280) : "";
  tx.reviewedBy = req.user._id;
  tx.reviewedAt = new Date();
  await tx.save();

  await recordAudit({
    actor: req.user,
    action: "transfer.review",
    targetType: "Transaction",
    targetId: tx._id,
    summary: `Marked transfer as ${reviewStatus}: ${tx.reviewNote || "No note"}`,
    req,
  });

  res.status(200).json({
    message: `Transfer marked as ${reviewStatus}`,
    transaction: tx.toObject({ transform: false }),
  });
});

module.exports = {
  getOverview,
  listAllAccounts,
  openAccountForCustomer,
  listFlaggedTransfers,
  reviewFlaggedTransfer,
};
