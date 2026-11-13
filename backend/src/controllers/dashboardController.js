const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const asyncHandler = require("../utils/asyncHandler");
const { lastMonthKeys, lastDayKeys, monthKeyToQueryStart } = require("../utils/dateRanges");
const { CURRENCY, TIMEZONE } = require("../config/constants");

const CASHFLOW_MONTHS = 6;
const TREND_DAYS = 7;
const RECENT_COUNT = 6;

// GET /api/dashboard/summary - everything the customer overview needs in one
// call. All money values are integer minor units.
const getSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const accounts = await Account.find({ user: userId, status: { $ne: "closed" } }).sort({
    createdAt: 1,
  });
  const accountIds = accounts.map((account) => account._id);
  const totalBalanceMinor = accounts.reduce((sum, account) => sum + account.balance, 0);

  // Money in / out per month. Transfers between a customer's own accounts are
  // excluded because they don't change how much money the customer has.
  const monthKeys = lastMonthKeys(CASHFLOW_MONTHS);
  const cashflowRows = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        status: "completed",
        isInternal: { $ne: true },
        createdAt: { $gte: monthKeyToQueryStart(monthKeys[0]) },
      },
    },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: TIMEZONE } },
          direction: { $cond: [{ $gt: ["$amount", 0] }, "in", "out"] },
        },
        total: { $sum: "$amount" },
      },
    },
  ]);

  const flowByKey = new Map(
    cashflowRows.map((row) => [`${row._id.month}|${row._id.direction}`, row.total])
  );
  const cashflow = monthKeys.map((month) => ({
    month,
    inMinor: flowByKey.get(`${month}|in`) || 0,
    outMinor: Math.abs(flowByKey.get(`${month}|out`) || 0),
  }));
  const currentMonth = cashflow[cashflow.length - 1];

  // Daily total balance, worked backwards from today's balance using each
  // day's net movement.
  const dayKeys = lastDayKeys(TREND_DAYS);
  const dailyRows = accountIds.length
    ? await Transaction.aggregate([
        {
          $match: {
            account: { $in: accountIds },
            status: "completed",
            createdAt: { $gte: new Date(Date.now() - (TREND_DAYS + 1) * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TIMEZONE } },
            net: { $sum: "$amount" },
          },
        },
      ])
    : [];
  const netByDay = new Map(dailyRows.map((row) => [row._id, row.net]));

  const balanceTrend = new Array(dayKeys.length);
  let running = totalBalanceMinor;
  for (let i = dayKeys.length - 1; i >= 0; i -= 1) {
    balanceTrend[i] = { date: dayKeys[i], balanceMinor: running };
    running -= netByDay.get(dayKeys[i]) || 0;
  }

  const [recentTransactions, pendingCount] = await Promise.all([
    Transaction.find({ user: userId }).sort({ createdAt: -1, _id: -1 }).limit(RECENT_COUNT),
    Transaction.countDocuments({ user: userId, status: "pending" }),
  ]);

  res.status(200).json({
    currency: CURRENCY,
    totals: {
      balanceMinor: totalBalanceMinor,
      moneyInMinor: currentMonth.inMinor,
      moneyOutMinor: currentMonth.outMinor,
      pendingCount,
    },
    accounts,
    cashflow,
    balanceTrend,
    recentTransactions,
  });
});

module.exports = { getSummary };
