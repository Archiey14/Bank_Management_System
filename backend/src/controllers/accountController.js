const mongoose = require("mongoose");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { parseAmountMinor } = require("../utils/money");
const { readIdempotencyKey, findPriorEntry } = require("../utils/idempotency");
const { isObjectIdString, cleanDescription } = require("../utils/validators");
const {
  ACCOUNT_TYPES,
  MAX_ACCOUNTS_PER_USER,
  ALLOW_CUSTOMER_DEPOSITS,
} = require("../config/constants");

const isStaff = (user) => user.role === "staff" || user.role === "admin";

// Customers can only reach their own accounts; staff and admins can reach any.
// Anything else is a 404 so account ids can't be probed.
const findAccountFor = async (id, user) => {
  if (!isObjectIdString(id)) throw new AppError("Account not found", 404);
  const account = await Account.findById(id);
  if (!account || (!isStaff(user) && !account.user.equals(user._id))) {
    throw new AppError("Account not found", 404);
  }
  return account;
};

const listAccounts = asyncHandler(async (req, res) => {
  const accounts = await Account.find({ user: req.user._id }).sort({ createdAt: 1 });
  res.status(200).json({ accounts });
});

const openAccount = asyncHandler(async (req, res) => {
  const { type } = req.body ?? {};
  if (!ACCOUNT_TYPES.includes(type)) {
    throw new AppError(`Account type must be one of: ${ACCOUNT_TYPES.join(", ")}`, 400);
  }

  const openCount = await Account.countDocuments({
    user: req.user._id,
    status: { $ne: "closed" },
  });
  if (openCount >= MAX_ACCOUNTS_PER_USER) {
    throw new AppError(`You can have at most ${MAX_ACCOUNTS_PER_USER} open accounts`, 400);
  }

  // Account numbers are random, so retry in the rare case of a collision.
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const account = await Account.create({
        user: req.user._id,
        type,
        accountNumber: Account.generateAccountNumber(),
      });
      return res.status(201).json({ message: "Account opened", account });
    } catch (error) {
      if (error.code === 11000 && attempt < 5) continue;
      throw error;
    }
  }
  return undefined;
});

const getAccount = asyncHandler(async (req, res) => {
  const account = await findAccountFor(req.params.id, req.user);
  res.status(200).json({ account });
});

// Shared by deposit and withdrawal: adjust the balance and write the ledger
// row in one database transaction.
const postEntry = (kind) =>
  asyncHandler(async (req, res) => {
    if (kind === "deposit" && !ALLOW_CUSTOMER_DEPOSITS && !isStaff(req.user)) {
      throw new AppError("Deposits are handled by bank staff", 403);
    }

    const body = req.body ?? {};
    const amountMinor = parseAmountMinor(body.amountMinor);
    const description = cleanDescription(
      body.description,
      kind === "deposit" ? "Deposit" : "Withdrawal"
    );
    const idempotencyKey = readIdempotencyKey(req);
    const account = await findAccountFor(req.params.id, req.user);

    const replay = async (prior) => {
      const sameRequest =
        prior.type === kind &&
        prior.account.equals(account._id) &&
        Math.abs(prior.amount) === amountMinor;
      if (!sameRequest) {
        throw new AppError("This Idempotency-Key was already used for a different request", 409);
      }
      const current = await Account.findById(account._id);
      return res.status(200).json({
        message: "Request already processed",
        replayed: true,
        transaction: prior,
        account: current,
      });
    };

    const prior = await findPriorEntry(req.user._id, idempotencyKey);
    if (prior) return replay(prior);

    const delta = kind === "deposit" ? amountMinor : -amountMinor;
    let entry;
    let updatedAccount;

    try {
      await mongoose.connection.transaction(async (session) => {
        const filter = { _id: account._id, status: "active" };
        // Debits only match when funds are available, so the balance can never
        // go negative even with concurrent requests.
        if (delta < 0) filter.balance = { $gte: amountMinor };

        const updated = await Account.findOneAndUpdate(
          filter,
          { $inc: { balance: delta } },
          { returnDocument: "after", session }
        );

        if (!updated) {
          const fresh = await Account.findById(account._id).session(session);
          if (!fresh || fresh.status !== "active") {
            throw new AppError("Account is not active", 409);
          }
          throw new AppError("Insufficient funds", 422);
        }

        const [created] = await Transaction.create(
          [
            {
              account: updated._id,
              user: updated.user,
              initiatedBy: req.user._id,
              type: kind,
              amount: delta,
              balanceAfter: updated.balance,
              description,
              idempotencyKey: idempotencyKey || undefined,
            },
          ],
          { session }
        );

        entry = created;
        updatedAccount = updated;
      });
    } catch (error) {
      // Two identical requests raced: the unique index let only one through.
      if (error.code === 11000 && idempotencyKey) {
        const raced = await findPriorEntry(req.user._id, idempotencyKey);
        if (raced) return replay(raced);
      }
      throw error;
    }

    return res.status(201).json({
      message: kind === "deposit" ? "Deposit successful" : "Withdrawal successful",
      transaction: entry,
      account: updatedAccount,
    });
  });

module.exports = {
  listAccounts,
  openAccount,
  getAccount,
  deposit: postEntry("deposit"),
  withdraw: postEntry("withdrawal"),
};
