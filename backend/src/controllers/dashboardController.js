const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const asyncHandler = require("../utils/asyncHandler");
const { lastMonthKeys, lastDayKeys, monthKeyToQueryStart } = require("../utils/dateRanges");
const { CURRENCY, TIMEZONE } = require("../config/constants");

const CASHFLOW_MONTHS = 6;
const TREND_DAYS = 7;
const RECENT_COUNT = 6;

// Parse an optional YYYY-MM-DD query param. Returns a Date (UTC midnight) or null.
const parseDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const d = new Date(`${value.trim()}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// GET /api/dashboard/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// `from` and `to` are optional.  When omitted the totals window defaults to
// the current calendar month.  The cashflow chart (last 6 months) and balance
// trend (last 7 days) are always fixed windows regardless of the range.
const getSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // ── Totals date window ────────────────────────────────────────────────────
  const fromParam = parseDate(req.query.from);
  const toParam   = parseDate(req.query.to);

  // Default: first millisecond of the current calendar month → now.
  const monthKeys = lastMonthKeys(CASHFLOW_MONTHS);
  const currentMonthKey = monthKeys[monthKeys.length - 1];
  const [cmYear, cmMonth] = currentMonthKey.split("-").map(Number);
  const defaultFrom = new Date(Date.UTC(cmYear, cmMonth - 1, 1));
  const defaultTo   = new Date();

  const totalsFrom = fromParam ?? defaultFrom;
  // `to` is inclusive: extend to the last millisecond of that day.
  const totalsTo = toParam
    ? new Date(toParam.getTime() + 24 * 60 * 60 * 1000 - 1)
    : defaultTo;

  if (totalsFrom > totalsTo) {
    return res.status(400).json({ message: '"from" must be before "to"' });
  }

  // ── Accounts ──────────────────────────────────────────────────────────────
  const accounts = await Account.find({ user: userId, status: { $ne: "closed" } }).sort({
    createdAt: 1,
  });
  const accountIds = accounts.map((a) => a._id);
  const totalBalanceMinor = accounts.reduce((sum, a) => sum + a.balance, 0);

  // ── Totals for the requested window ───────────────────────────────────────
  // Transfers between the customer's own accounts are excluded: they don't
  // change the customer's total wealth.
  const totalsRows = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        status: "completed",
        isInternal: { $ne: true },
        createdAt: { $gte: totalsFrom, $lte: totalsTo },
      },
    },
    {
      $group: {
        _id: { $cond: [{ $gt: ["$amount", 0] }, "in", "out"] },
        total: { $sum: "$amount" },
      },
    },
  ]);
  const totalsMap = new Map(totalsRows.map((row) => [row._id, row.total]));
  const moneyInMinor  = totalsMap.get("in")  || 0;
  const moneyOutMinor = Math.abs(totalsMap.get("out") || 0);

  // ── Cashflow chart (fixed: last 6 calendar months) ────────────────────────
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
    inMinor:  flowByKey.get(`${month}|in`)  || 0,
    outMinor: Math.abs(flowByKey.get(`${month}|out`) || 0),
  }));

  // ── Balance trend (fixed: last 7 days) ───────────────────────────────────
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

  // ── Recent transactions & pending count ───────────────────────────────────
  const [recentTransactions, pendingCount] = await Promise.all([
    Transaction.find({ user: userId }).sort({ createdAt: -1, _id: -1 }).limit(RECENT_COUNT),
    Transaction.countDocuments({ user: userId, status: "pending" }),
  ]);

  res.status(200).json({
    currency: CURRENCY,
    totals: {
      balanceMinor: totalBalanceMinor,
      moneyInMinor,
      moneyOutMinor,
      pendingCount,
    },
    accounts,
    cashflow,
    balanceTrend,
    recentTransactions,
  });
});

module.exports = { getSummary };
