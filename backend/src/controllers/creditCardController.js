const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Account = require("../models/Account");
const CreditCard = require("../models/CreditCard");
const CardTransaction = require("../models/CardTransaction");
const Transaction = require("../models/Transaction");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { parseAmountMinor } = require("../utils/money");
const { readIdempotencyKey } = require("../utils/idempotency");
const { isObjectIdString, clampInt } = require("../utils/validators");
const { rupees } = require("../utils/cards");
const { CREDIT_PAYMENT_WINDOW_DAYS } = require("../config/constants");

const BLOCKED_MESSAGE = "This card is blocked. Contact bank support if you need assistance.";

const findOwnCard = async (id, userId) => {
  if (!isObjectIdString(id)) throw new AppError("Card not found", 404);
  const card = await CreditCard.findOne({ _id: id, user: userId });
  if (!card) throw new AppError("Card not found", 404);
  return card;
};

const findPriorEntry = (userId, key) =>
  key ? CardTransaction.findOne({ user: userId, idempotencyKey: key }) : null;

const dueDateFromNow = () => new Date(Date.now() + CREDIT_PAYMENT_WINDOW_DAYS * 86_400_000);

// GET /api/cards/credit
const listCreditCards = asyncHandler(async (req, res) => {
  const cards = await CreditCard.find({ user: req.user._id }).sort({ createdAt: -1, _id: -1 });
  res.status(200).json({ cards });
});

// GET /api/cards/credit/:id/transactions
const listCardTransactions = asyncHandler(async (req, res) => {
  const card = await findOwnCard(req.params.id, req.user._id);
  const limit = clampInt(req.query.limit, 20, 1, 100);
  const transactions = await CardTransaction.find({ card: card._id, user: req.user._id })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit);
  res.status(200).json({ transactions });
});

// POST /api/cards/credit/:id/purchase - a simulated merchant purchase. The
// outstanding balance can never pass the credit limit, even with concurrent
// requests, because the limit check is part of the atomic update.
const purchase = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const amountMinor = parseAmountMinor(body.amountMinor);
  const merchant = typeof body.merchant === "string" ? body.merchant.trim() : "";
  if (merchant.length < 2 || merchant.length > 60) {
    throw new AppError("Enter the merchant name (2 to 60 characters)", 400);
  }
  const idempotencyKey = readIdempotencyKey(req);
  const card = await findOwnCard(req.params.id, req.user._id);

  const replay = async (prior) => {
    const sameRequest =
      prior.type === "purchase" && prior.card.equals(card._id) && prior.amount === amountMinor;
    if (!sameRequest) {
      throw new AppError("This Idempotency-Key was already used for a different request", 409);
    }
    return res.status(200).json({
      message: "Purchase already processed",
      replayed: true,
      transaction: prior,
      card: await CreditCard.findById(card._id),
    });
  };

  const prior = await findPriorEntry(req.user._id, idempotencyKey);
  if (prior) return replay(prior);

  if (card.status !== "active") throw new AppError(BLOCKED_MESSAGE, 409);

  let entry;
  try {
    await mongoose.connection.transaction(async (session) => {
      const updated = await CreditCard.findOneAndUpdate(
        {
          _id: card._id,
          user: req.user._id,
          status: "active",
          $expr: { $lte: [{ $add: ["$outstanding", amountMinor] }, "$creditLimit"] },
        },
        { $inc: { outstanding: amountMinor } },
        { returnDocument: "after", session }
      );
      if (!updated) {
        const fresh = await CreditCard.findById(card._id).session(session);
        if (!fresh || fresh.status !== "active") throw new AppError(BLOCKED_MESSAGE, 409);
        throw new AppError(
          `Purchase exceeds your available credit of ${rupees(Math.max(0, fresh.creditLimit - fresh.outstanding))}`,
          422
        );
      }

      // First balance owed: schedule the payment due date.
      await CreditCard.updateOne(
        { _id: card._id, dueDate: null },
        { $set: { dueDate: dueDateFromNow() } },
        { session }
      );

      [entry] = await CardTransaction.create(
        [
          {
            card: card._id,
            user: req.user._id,
            type: "purchase",
            amount: amountMinor,
            outstandingAfter: updated.outstanding,
            merchant,
            description: `Purchase at ${merchant}`,
            idempotencyKey: idempotencyKey || undefined,
          },
        ],
        { session }
      );
    });
  } catch (error) {
    if (error.code === 11000 && idempotencyKey) {
      const raced = await findPriorEntry(req.user._id, idempotencyKey);
      if (raced) return replay(raced);
    }
    throw error;
  }

  return res.status(201).json({
    message: "Purchase successful",
    transaction: entry,
    card: await CreditCard.findById(card._id),
  });
});

// POST /api/cards/credit/:id/repay - pay down the balance from a bank account.
// The account debit, the card credit and both ledger rows commit together.
const repay = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const amountMinor = parseAmountMinor(body.amountMinor);
  if (!isObjectIdString(body.fromAccountId)) {
    throw new AppError("Choose the account to pay from", 400);
  }
  const idempotencyKey = readIdempotencyKey(req);
  const card = await findOwnCard(req.params.id, req.user._id);

  const source = await Account.findOne({ _id: body.fromAccountId, user: req.user._id });
  if (!source) throw new AppError("Source account not found", 404);

  const replay = async (prior) => {
    const sameRequest =
      prior.type === "repayment" &&
      prior.card.equals(card._id) &&
      prior.amount === amountMinor &&
      prior.account?.equals(source._id);
    if (!sameRequest) {
      throw new AppError("This Idempotency-Key was already used for a different request", 409);
    }
    return res.status(200).json({
      message: "Payment already processed",
      replayed: true,
      transaction: prior,
      card: await CreditCard.findById(card._id),
    });
  };

  const prior = await findPriorEntry(req.user._id, idempotencyKey);
  if (prior) return replay(prior);

  if (card.outstanding <= 0) throw new AppError("There is no outstanding balance to pay", 409);
  if (amountMinor > card.outstanding) {
    throw new AppError(
      `The amount exceeds your outstanding balance of ${rupees(card.outstanding)}`,
      422
    );
  }

  let entry;
  try {
    await mongoose.connection.transaction(async (session) => {
      const debited = await Account.findOneAndUpdate(
        { _id: source._id, status: "active", balance: { $gte: amountMinor } },
        { $inc: { balance: -amountMinor } },
        { returnDocument: "after", session }
      );
      if (!debited) {
        const fresh = await Account.findById(source._id).session(session);
        if (!fresh || fresh.status !== "active") {
          throw new AppError("Source account is not active", 409);
        }
        throw new AppError("Insufficient funds", 422);
      }

      const updated = await CreditCard.findOneAndUpdate(
        { _id: card._id, user: req.user._id, outstanding: { $gte: amountMinor } },
        { $inc: { outstanding: -amountMinor } },
        { returnDocument: "after", session }
      );
      // Throwing aborts the transaction, which also undoes the account debit.
      if (!updated) {
        throw new AppError("The amount exceeds your outstanding balance", 422);
      }
      if (updated.outstanding === 0) {
        await CreditCard.updateOne({ _id: card._id }, { $set: { dueDate: null } }, { session });
      }

      await Transaction.create(
        [
          {
            account: source._id,
            user: source.user,
            initiatedBy: req.user._id,
            type: "bill_payment",
            amount: -amountMinor,
            balanceAfter: debited.balance,
            description: `Credit card payment •••• ${card.last4}`,
            biller: "Credit card",
            billReference: card.last4,
          },
        ],
        { session }
      );

      [entry] = await CardTransaction.create(
        [
          {
            card: card._id,
            user: req.user._id,
            type: "repayment",
            amount: amountMinor,
            outstandingAfter: updated.outstanding,
            description: `Payment from account ending ${source.accountNumber.slice(-4)}`,
            account: source._id,
            idempotencyKey: idempotencyKey || undefined,
          },
        ],
        { session }
      );
    });
  } catch (error) {
    if (error.code === 11000 && idempotencyKey) {
      const raced = await findPriorEntry(req.user._id, idempotencyKey);
      if (raced) return replay(raced);
    }
    throw error;
  }

  return res.status(201).json({
    message: "Payment successful",
    transaction: entry,
    card: await CreditCard.findById(card._id),
  });
});

// POST /api/cards/credit/:id/block - customers can block; only staff can release.
const blockCreditCard = asyncHandler(async (req, res) => {
  const card = await findOwnCard(req.params.id, req.user._id);
  const updated = await CreditCard.findOneAndUpdate(
    { _id: card._id, user: req.user._id, status: { $ne: "blocked" } },
    { $set: { status: "blocked", blockedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!updated) throw new AppError("This card is already blocked", 409);

  res.status(200).json({ message: "Card blocked", card: updated });
});

// POST /api/cards/credit/:id/pin - change the PIN of an active credit card.
// Accepts 4-6 digits or hexadecimal characters (e.g. 1234 or A4F2).
const changeCreditCardPin = asyncHandler(async (req, res) => {
  const pin = typeof req.body?.pin === "string" ? req.body.pin.trim().toUpperCase() : "";
  if (!/^[0-9A-F]{4,6}$/.test(pin)) {
    throw new AppError("Choose a 4 to 6 character PIN (digits 0-9 or hexadecimal A-F)", 400);
  }
  if (/^(\w)\1+$/.test(pin)) {
    throw new AppError("Choose a PIN that is harder to guess", 400);
  }

  const card = await findOwnCard(req.params.id, req.user._id);
  if (card.status === "blocked") throw new AppError(BLOCKED_MESSAGE, 409);

  const pinHash = await bcrypt.hash(pin, 10);
  const updated = await CreditCard.findOneAndUpdate(
    { _id: card._id, user: req.user._id, status: { $ne: "blocked" } },
    { $set: { pinHash } },
    { returnDocument: "after" }
  );

  if (!updated) throw new AppError("This credit card PIN could not be updated", 409);

  res.status(200).json({ message: "Credit card PIN updated successfully", card: updated });
});

module.exports = {
  listCreditCards,
  listCardTransactions,
  purchase,
  repay,
  blockCreditCard,
  changeCreditCardPin,
};
