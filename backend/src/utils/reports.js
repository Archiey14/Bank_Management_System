const User = require("../models/User");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const { lastDayKeys } = require("./dateRanges");
const { CURRENCY, TIMEZONE } = require("../config/constants");

// Money-moving ledger rows. `transfer_in` is left out so a transfer counts once.
const VOLUME_TYPES = ["deposit", "withdrawal", "transfer_out", "bill_payment"];

// Bank-wide activity over the last `days` days (shared by staff and admin).
const buildOverview = async (days) => {
  const dayKeys = lastDayKeys(days);
  const periodStart = new Date(Date.now() - (days + 1) * 24 * 60 * 60 * 1000);

  const [customers, newCustomers, accountTotals, activityRows, pendingReviews] = await Promise.all([
    User.countDocuments({ role: "customer" }),
    User.countDocuments({
      role: "customer",
      createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
    }),
    Account.aggregate([
      { $match: { status: { $ne: "closed" } } },
      { $group: { _id: null, count: { $sum: 1 }, balance: { $sum: "$balance" } } },
    ]),
    Transaction.aggregate([
      {
        $match: {
          status: "completed",
          type: { $in: VOLUME_TYPES },
          createdAt: { $gte: periodStart },
        },
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TIMEZONE } },
            type: "$type",
          },
          count: { $sum: 1 },
          volume: { $sum: { $abs: "$amount" } },
        },
      },
    ]),
    Transaction.countDocuments({ flagged: true, reviewStatus: "pending" }),
  ]);

  const inPeriod = new Set(dayKeys);
  const byType = new Map(VOLUME_TYPES.map((type) => [type, { type, count: 0, volumeMinor: 0 }]));
  const byDay = new Map(dayKeys.map((date) => [date, { date, count: 0, volumeMinor: 0 }]));

  activityRows.forEach((row) => {
    if (!inPeriod.has(row._id.day)) return;
    const typeRow = byType.get(row._id.type);
    typeRow.count += row.count;
    typeRow.volumeMinor += row.volume;
    const dayRow = byDay.get(row._id.day);
    dayRow.count += row.count;
    dayRow.volumeMinor += row.volume;
  });

  const accounts = accountTotals[0] || { count: 0, balance: 0 };
  return {
    currency: CURRENCY,
    days,
    totals: {
      customers,
      newCustomers,
      openAccounts: accounts.count,
      totalBalanceMinor: accounts.balance,
      pendingReviews,
    },
    byType: [...byType.values()],
    daily: [...byDay.values()],
  };
};

// Overview plus system-wide numbers that only admins see.
const buildSystemReport = async (days) => {
  const [overview, roleRows, inactiveUsers, accountTypeRows, accountStatusRows] = await Promise.all([
    buildOverview(days),
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    User.countDocuments({ isActive: false }),
    Account.aggregate([
      { $match: { status: { $ne: "closed" } } },
      { $group: { _id: "$type", count: { $sum: 1 }, balance: { $sum: "$balance" } } },
    ]),
    Account.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const usersByRole = { customer: 0, staff: 0, admin: 0 };
  roleRows.forEach((row) => {
    usersByRole[row._id] = row.count;
  });
  const accountsByStatus = { active: 0, frozen: 0, closed: 0 };
  accountStatusRows.forEach((row) => {
    accountsByStatus[row._id] = row.count;
  });

  return {
    ...overview,
    system: {
      usersByRole,
      inactiveUsers,
      accountsByType: accountTypeRows.map((row) => ({
        type: row._id,
        count: row.count,
        balanceMinor: row.balance,
      })),
      accountsByStatus,
    },
  };
};

module.exports = { buildOverview, buildSystemReport };
