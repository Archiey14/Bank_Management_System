const User = require("../models/User");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const AuditLog = require("../models/AuditLog");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { recordAudit } = require("../utils/audit");
const { clampInt, escapeRegex } = require("../utils/validators");
const { ROLES, STAFF_ROLES } = require("../config/constants");

// GET /api/admin/users - list users with search and role filter
const listUsers = asyncHandler(async (req, res) => {
  const page = clampInt(req.query.page, 1, 1, 100000);
  const limit = clampInt(req.query.limit, 20, 1, 100);
  const filter = {};

  if (req.query.role && ROLES.includes(req.query.role)) {
    filter.role = req.query.role;
  }

  if (req.query.status === "active") {
    filter.isActive = true;
  } else if (req.query.status === "inactive") {
    filter.isActive = false;
  }

  if (req.query.q) {
    const regex = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// POST /api/admin/users - Admin creates a new staff or admin user
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role = "staff" } = req.body ?? {};

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    throw new AppError("Name must be at least 2 characters", 400);
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new AppError("A valid email address is required", 400);
  }

  if (!password || password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  if (!STAFF_ROLES.includes(role)) {
    throw new AppError("Admin can only create staff or admin accounts", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new AppError("A user with this email address already exists", 409);
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    role,
    isActive: true,
    isEmailVerified: true,
  });

  await recordAudit({
    actor: req.user,
    action: "user.create",
    targetType: "User",
    targetId: user._id,
    summary: `Created ${role} account for ${user.email}`,
    req,
  });

  res.status(201).json({
    message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
    user,
  });
});

// PATCH /api/admin/users/:id - update user role or status (active/deactivated)
const updateUser = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(req.params.id);
  if (!targetUser) {
    throw new AppError("User not found", 404);
  }

  // Prevent admin from deactivating or demoting themselves
  if (targetUser._id.equals(req.user._id)) {
    if (req.body?.isActive === false) {
      throw new AppError("You cannot deactivate your own account", 400);
    }
    if (req.body?.role && req.body.role !== "admin") {
      throw new AppError("You cannot remove your own admin privileges", 400);
    }
  }

  const { role, isActive } = req.body ?? {};
  let changed = false;

  if (role !== undefined) {
    if (!ROLES.includes(role)) {
      throw new AppError(`Role must be one of: ${ROLES.join(", ")}`, 400);
    }
    targetUser.role = role;
    changed = true;
  }

  if (isActive !== undefined) {
    targetUser.isActive = Boolean(isActive);
    changed = true;
  }

  if (changed) {
    await targetUser.save();
    await recordAudit({
      actor: req.user,
      action: "user.update",
      targetType: "User",
      targetId: targetUser._id,
      summary: `Updated user ${targetUser.email}: role=${targetUser.role}, active=${targetUser.isActive}`,
      req,
    });
  }

  res.status(200).json({
    message: "User updated successfully",
    user: targetUser,
  });
});

// GET /api/admin/audit-logs - read audit logs
const listAuditLogs = asyncHandler(async (req, res) => {
  const page = clampInt(req.query.page, 1, 1, 100000);
  const limit = clampInt(req.query.limit, 25, 1, 100);
  const filter = {};

  if (req.query.action) {
    filter.action = req.query.action;
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("actor", "name email role"),
    AuditLog.countDocuments(filter),
  ]);

  res.status(200).json({
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/admin/reports - system-wide telemetry & aggregated reports
const getSystemReports = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    customersCount,
    staffCount,
    adminsCount,
    totalAccounts,
    activeAccounts,
    frozenAccounts,
    balanceAgg,
    transactionsCount,
    flaggedCount,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "customer" }),
    User.countDocuments({ role: "staff" }),
    User.countDocuments({ role: "admin" }),
    Account.countDocuments(),
    Account.countDocuments({ status: "active" }),
    Account.countDocuments({ status: "frozen" }),
    Account.aggregate([
      { $match: { status: { $ne: "closed" } } },
      { $group: { _id: null, totalBalanceMinor: { $sum: "$balance" } } },
    ]),
    Transaction.countDocuments(),
    Transaction.countDocuments({ flagged: true, reviewStatus: "pending" }),
  ]);

  const totalBalanceMinor = balanceAgg[0]?.totalBalanceMinor || 0;

  res.status(200).json({
    users: {
      total: totalUsers,
      customers: customersCount,
      staff: staffCount,
      admins: adminsCount,
    },
    accounts: {
      total: totalAccounts,
      active: activeAccounts,
      frozen: frozenAccounts,
      totalBalanceMinor,
    },
    transactions: {
      total: transactionsCount,
      pendingFlagged: flaggedCount,
    },
  });
});

module.exports = {
  listUsers,
  createUser,
  updateUser,
  listAuditLogs,
  getSystemReports,
};

