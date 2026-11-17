const mongoose = require("mongoose");
const Account = require("../models/Account");
const FixedDeposit = require("../models/FixedDeposit");
const Transaction = require("../models/Transaction");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { parseAmountMinor } = require("../utils/money");
const { readIdempotencyKey, findPriorEntry } = require("../utils/idempotency");
const {
  FD_TENURES_MONTHS,
  FD_RATES_PERCENT,
  FD_MIN_AMOUNT_MINOR,
  FD_BREAK_PENALTY_RATE,
} = require("../config/constants");

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const daysBetween = (from, to) => Math.floor((to.getTime() - from.getTime()) / 86_400_000);

// What the customer would receive if the deposit were settled right now.
const settlementPreview = (fd, now = new Date()) => {
  if (now >= fd.maturityDate) {
    return { settlementMinor: fd.maturityAmountMinor, accruedMinor: fd.interestMinor, penaltyMinor: 0, matured: true };
  }
  const daysHeld = Math.max(0, daysBetween(fd.openedAt, now));
  const accruedMinor = Math.round(fd.principalMinor * (fd.ratePercent / 100) * (daysHeld / 365));
  const penaltyMinor = Math.round(fd.principalMinor * FD_BREAK_PENALTY_RATE);
  return {
    settlementMinor: fd.principalMinor + accruedMinor - penaltyMinor,
    accruedMinor,
    penaltyMinor,
    matured: false,
  };
};

// POST /api/fixed-deposits - book a term deposit. The principal leaves the
// source account and the FD is created in one database transaction.
const bookFixedDeposit = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const principalMinor = parseAmountMinor(body.principalMinor);
  if (principalMinor < FD_MIN_AMOUNT_MINOR) {
    throw new AppError(
      `Fixed deposits start at ${FD_MIN_AMOUNT_MINOR / 100} in ${process.env.DEFAULT_CURRENCY || "INR"}`,
      400
    );
  }
  const tenureMonths = Number(body.tenureMonths);
  if (!FD_TENURES_MONTHS.includes(tenureMonths)) {
    throw new AppError(`Tenure must be one of: ${FD_TENURES_MONTHS.join(", ")} months`, 400);
  }
  if (typeof body.sourceAccountId !== "string" || !/^[0-9a-fA-F]{24}$/.test(body.sourceAccountId)) {
    throw new AppError("sourceAccountId is required", 400);
  }
  const idempotencyKey = readIdempotencyKey(req);

  const source = await Account.findOne({ _id: body.sourceAccountId, user: req.user._id });
  if (!source) throw new AppError("Source account not found", 404);

  const replay = async (prior) => {
    const sameRequest =
      prior.type === "fd_booking" &&
      prior.account.equals(source._id) &&
      prior.amount === -principalMinor;
    if (!sameRequest) {
      throw new AppError("This Idempotency-Key was already used for a different request", 409);
    }
    const deposit = await FixedDeposit.findOne({ user: req.user._id, sourceAccount: source._id, principalMinor }).sort({ createdAt: -1 });
    return res.status(200).json({ message: "Fixed deposit already booked", replayed: true, fixedDeposit: deposit, transaction: prior });
  };

  const prior = await findPriorEntry(req.user._id, idempotencyKey);
  if (prior) return replay(prior);

  const ratePercent = FD_RATES_PERCENT[tenureMonths];
  const interestMinor = Math.round(principalMinor * (ratePercent / 100) * (tenureMonths / 12));
  const maturityAmountMinor = principalMinor + interestMinor;
  const maturityDate = addMonths(new Date(), tenureMonths);
  const description = `Fixed deposit booked for ${tenureMonths} months at ${ratePercent}% p.a.`;

  let fixedDeposit;
  let entry;
  try {
    await mongoose.connection.transaction(async (session) => {
      const debited = await Account.findOneAndUpdate(
        { _id: source._id, status: "active", balance: { $gte: principalMinor } },
        { $inc: { balance: -principalMinor } },
        { returnDocument: "after", session }
      );
      if (!debited) {
        const fresh = await Account.findById(source._id).session(session);
        if (!fresh || fresh.status !== "active") {
          throw new AppError("Source account is not active", 409);
        }
        throw new AppError("Insufficient funds", 422);
      }

      [fixedDeposit] = await FixedDeposit.create(
        [
          {
            user: req.user._id,
            sourceAccount: source._id,
            creditAccount: source._id,
            principalMinor,
            ratePercent,
            tenureMonths,
            interestMinor,
            maturityAmountMinor,
            maturityDate,
          },
        ],
        { session }
      );

      [entry] = await Transaction.create(
        [
          {
            account: source._id,
            user: source.user,
            initiatedBy: req.user._id,
            type: "fd_booking",
            amount: -principalMinor,
            balanceAfter: debited.balance,
            description,
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

  res.status(201).json({
    message: "Fixed deposit booked",
    fixedDeposit,
    transaction: entry,
  });
});

// GET /api/fixed-deposits - the customer's deposits with live payout previews.
const listFixedDeposits = asyncHandler(async (req, res) => {
  const deposits = await FixedDeposit.find({ user: req.user._id }).sort({ createdAt: -1 });
  const now = new Date();
  const fixedDeposits = deposits.map((doc) => {
    const fd = doc.toJSON();
    if (fd.status === "active") {
      const preview = settlementPreview(doc, now);
      fd.preview = preview;
    }
    return fd;
  });
  res.status(200).json({ fixedDeposits });
});

// POST /api/fixed-deposits/:id/settle - pay out an active deposit. Early breaks
// earn pro-rata interest minus the break penalty.
const settleFixedDeposit = asyncHandler(async (req, res) => {
  const fd = await FixedDeposit.findOne({ _id: req.params.id, user: req.user._id });
  if (!fd) throw new AppError("Fixed deposit not found", 404);

  const now = new Date();
  const { settlementMinor, matured } = settlementPreview(fd, now);

  let creditAccount = await Account.findById(fd.creditAccount);
  if (!creditAccount || creditAccount.status !== "active") {
    creditAccount = await Account.findOne({ user: req.user._id, status: "active" });
    if (!creditAccount) {
      throw new AppError("No active account available to receive the payout", 400);
    }
  }

  const description = matured
    ? "Fixed deposit matured — payout"
    : "Fixed deposit broken early — payout";

  let updatedAccount;
  let settled;
  await mongoose.connection.transaction(async (session) => {
    // Claim the deposit atomically: two concurrent settle requests can never
    // both pay out.
    settled = await FixedDeposit.findOneAndUpdate(
      { _id: fd._id, user: req.user._id, status: "active" },
      {
        $set: {
          status: "settled",
          settledAt: now,
          settlementAmountMinor: settlementMinor,
          creditAccount: creditAccount._id,
        },
      },
      { returnDocument: "after", session }
    );
    if (!settled) throw new AppError("This fixed deposit has already been settled", 409);

    updatedAccount = await Account.findOneAndUpdate(
      { _id: creditAccount._id, status: "active" },
      { $inc: { balance: settlementMinor } },
      { returnDocument: "after", session }
    );
    if (!updatedAccount) throw new AppError("Credit account is not active", 409);

    await Transaction.create(
      [
        {
          account: creditAccount._id,
          user: creditAccount.user,
          initiatedBy: req.user._id,
          type: "fd_credit",
          amount: settlementMinor,
          balanceAfter: updatedAccount.balance,
          description,
        },
      ],
      { session }
    );
  });

  res.status(200).json({
    message: matured ? "Fixed deposit paid out at maturity" : "Fixed deposit broken and paid out",
    fixedDeposit: settled,
    account: updatedAccount,
  });
});

module.exports = { bookFixedDeposit, listFixedDeposits, settleFixedDeposit };
