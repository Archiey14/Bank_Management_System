const crypto = require("crypto");
const mongoose = require("mongoose");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { parseAmountMinor } = require("../utils/money");
const { readIdempotencyKey, findPriorEntry } = require("../utils/idempotency");
const {
  isObjectIdString,
  cleanDescription,
  clampInt,
  parseDateParam,
} = require("../utils/validators");
const { TRANSACTION_TYPES, TRANSACTION_STATUSES } = require("../config/constants");

const ACCOUNT_NUMBER_PATTERN = /^\d{12}$/;

const queryString = (value, name) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new AppError(`${name} must be a single value`, 400);
  return value;
};

// GET /api/transactions - the signed-in customer's own ledger, newest first.
const listTransactions = asyncHandler(async (req, res) => {
  const page = clampInt(req.query.page, 1, 1, 100000);
  const limit = clampInt(req.query.limit, 20, 1, 100);
  const filter = { user: req.user._id };

  const accountId = queryString(req.query.accountId, "accountId");
  if (accountId !== undefined) {
    if (!isObjectIdString(accountId)) throw new AppError("accountId is not valid", 400);
    filter.account = accountId;
  }

  const type = queryString(req.query.type, "type");
  if (type !== undefined) {
    if (!TRANSACTION_TYPES.includes(type)) {
      throw new AppError(`type must be one of: ${TRANSACTION_TYPES.join(", ")}`, 400);
    }
    filter.type = type;
  }

  const status = queryString(req.query.status, "status");
  if (status !== undefined) {
    if (!TRANSACTION_STATUSES.includes(status)) {
      throw new AppError(`status must be one of: ${TRANSACTION_STATUSES.join(", ")}`, 400);
    }
    filter.status = status;
  }

  const from = parseDateParam(req.query.from, "from");
  const to = parseDateParam(req.query.to, "to");
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Transaction.countDocuments(filter),
  ]);

  res.status(200).json({
    transactions,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

// POST /api/transfers - move money from one of the customer's accounts to any
// account number at the bank. Debit, credit and both ledger rows happen in one
// database transaction: either all of it is saved or none of it is.
const createTransfer = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const amountMinor = parseAmountMinor(body.amountMinor);
  const description = cleanDescription(body.description, "Transfer");
  const idempotencyKey = readIdempotencyKey(req);

  if (!isObjectIdString(body.fromAccountId)) {
    throw new AppError("fromAccountId is required", 400);
  }
  const toNumber = typeof body.toAccountNumber === "string" ? body.toAccountNumber.trim() : "";
  if (!ACCOUNT_NUMBER_PATTERN.test(toNumber)) {
    throw new AppError("Enter a valid 12-digit destination account number", 400);
  }

  const from = await Account.findOne({ _id: body.fromAccountId, user: req.user._id });
  if (!from) throw new AppError("Source account not found", 404);
  if (from.accountNumber === toNumber) {
    throw new AppError("Source and destination accounts must be different", 400);
  }
  const to = await Account.findOne({ accountNumber: toNumber });
  if (!to) throw new AppError("Destination account not found", 404);

  const replay = async (prior) => {
    const sameRequest =
      prior.type === "transfer_out" &&
      prior.account.equals(from._id) &&
      prior.amount === -amountMinor &&
      prior.counterpartyAccountNumber === to.accountNumber;
    if (!sameRequest) {
      throw new AppError("This Idempotency-Key was already used for a different request", 409);
    }
    const current = await Account.findById(from._id);
    return res.status(200).json({
      message: "Transfer already processed",
      replayed: true,
      transferId: prior.transferId,
      transaction: prior,
      account: current,
    });
  };

  const prior = await findPriorEntry(req.user._id, idempotencyKey);
  if (prior) return replay(prior);

  const transferId = crypto.randomUUID();
  const isInternal = to.user.equals(from.user);
  let outLeg;
  let debitedAccount;

  try {
    await mongoose.connection.transaction(async (session) => {
      const debited = await Account.findOneAndUpdate(
        { _id: from._id, status: "active", balance: { $gte: amountMinor } },
        { $inc: { balance: -amountMinor } },
        { returnDocument: "after", session }
      );
      if (!debited) {
        const fresh = await Account.findById(from._id).session(session);
        if (!fresh || fresh.status !== "active") {
          throw new AppError("Source account is not active", 409);
        }
        throw new AppError("Insufficient funds", 422);
      }

      const credited = await Account.findOneAndUpdate(
        { _id: to._id, status: "active" },
        { $inc: { balance: amountMinor } },
        { returnDocument: "after", session }
      );
      // Throwing here aborts the transaction, which also undoes the debit.
      if (!credited) throw new AppError("Destination account is not active", 409);

      const [created] = await Transaction.create(
        [
          {
            account: from._id,
            user: from.user,
            initiatedBy: req.user._id,
            type: "transfer_out",
            amount: -amountMinor,
            balanceAfter: debited.balance,
            description,
            transferId,
            counterpartyAccountNumber: to.accountNumber,
            isInternal,
            idempotencyKey: idempotencyKey || undefined,
          },
          {
            account: to._id,
            user: to.user,
            initiatedBy: req.user._id,
            type: "transfer_in",
            amount: amountMinor,
            balanceAfter: credited.balance,
            description,
            transferId,
            counterpartyAccountNumber: from.accountNumber,
            isInternal,
          },
        ],
        { session, ordered: true }
      );

      outLeg = created;
      debitedAccount = debited;
    });
  } catch (error) {
    if (error.code === 11000 && idempotencyKey) {
      const raced = await findPriorEntry(req.user._id, idempotencyKey);
      if (raced) return replay(raced);
    }
    throw error;
  }

  return res.status(201).json({
    message: "Transfer successful",
    transferId,
    transaction: outLeg,
    account: debitedAccount,
  });
});

module.exports = { listTransactions, createTransfer };
