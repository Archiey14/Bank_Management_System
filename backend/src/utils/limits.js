const Transaction = require("../models/Transaction");
const AppError = require("./AppError");
const { rupees } = require("./cards");
const {
  DAILY_WITHDRAWAL_LIMIT_MINOR,
  DAILY_TRANSFER_LIMIT_MINOR,
  MAX_CUSTOMER_DEPOSIT_MINOR,
} = require("../config/constants");

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60 * 1000; // UTC+05:30, no daylight saving

// Limits reset at 00:00 IST. Tests skip enforcement, like the rate limiters.
const limitsEnforced = () => process.env.NODE_ENV !== "test";

const startOfTodayIST = (now = new Date()) =>
  new Date(Math.floor((now.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS);

const nextResetIST = (now = new Date()) => new Date(startOfTodayIST(now).getTime() + DAY_MS);

const usedToday = async (userId, match) => {
  const [row] = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        status: "completed",
        createdAt: { $gte: startOfTodayIST() },
        ...match,
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return Math.abs(row?.total || 0);
};

const withdrawalUsedToday = (userId) => usedToday(userId, { type: "withdrawal" });
// Moving money between your own accounts does not count toward the limit.
const transferUsedToday = (userId) =>
  usedToday(userId, { type: "transfer_out", isInternal: { $ne: true } });

const getDailyLimits = async (userId) => {
  const [withdrawalUsed, transferUsed] = await Promise.all([
    withdrawalUsedToday(userId),
    transferUsedToday(userId),
  ]);
  return {
    withdrawal: { limit: DAILY_WITHDRAWAL_LIMIT_MINOR, used: withdrawalUsed },
    transfer: { limit: DAILY_TRANSFER_LIMIT_MINOR, used: transferUsed },
    depositMax: MAX_CUSTOMER_DEPOSIT_MINOR,
    resetsAt: nextResetIST().toISOString(),
  };
};

const assertWithinDailyLimit = async ({ userId, amountMinor, limit, used, label }) => {
  if (!limitsEnforced()) return;
  const spent = await used(userId);
  if (spent + amountMinor > limit) {
    const remaining = Math.max(0, limit - spent);
    throw new AppError(
      `This exceeds your daily ${label} limit of ${rupees(limit)}. ` +
        `You can still ${label} ${rupees(remaining)} today; the limit resets at midnight IST.`,
      422
    );
  }
};

const assertWithinWithdrawalLimit = (userId, amountMinor) =>
  assertWithinDailyLimit({
    userId,
    amountMinor,
    limit: DAILY_WITHDRAWAL_LIMIT_MINOR,
    used: withdrawalUsedToday,
    label: "withdrawal",
  });

const assertWithinTransferLimit = (userId, amountMinor) =>
  assertWithinDailyLimit({
    userId,
    amountMinor,
    limit: DAILY_TRANSFER_LIMIT_MINOR,
    used: transferUsedToday,
    label: "transfer",
  });

const assertWithinDepositMax = (amountMinor) => {
  if (limitsEnforced() && amountMinor > MAX_CUSTOMER_DEPOSIT_MINOR) {
    throw new AppError(
      `The maximum deposit per transaction is ${rupees(MAX_CUSTOMER_DEPOSIT_MINOR)}`,
      422
    );
  }
};

module.exports = {
  getDailyLimits,
  assertWithinWithdrawalLimit,
  assertWithinTransferLimit,
  assertWithinDepositMax,
  startOfTodayIST,
};
