const mongoose = require("mongoose");
const Account = require("../models/Account");
const AccountApplication = require("../models/AccountApplication");
const Transaction = require("../models/Transaction");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { recordAudit } = require("../utils/audit");
const { parseAmountMinor } = require("../utils/money");
const {
  ACCOUNT_TYPES,
  APPLICATION_STATUSES,
  OCCUPATIONS,
  INCOME_BANDS,
  MAX_ACCOUNTS_PER_USER,
} = require("../config/constants");
const { clampInt, escapeRegex } = require("../utils/validators");

const PHONE_PATTERN = /^[6-9]\d{9}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PINCODE_PATTERN = /^\d{6}$/;

const requireString = (value, label, { min = 1, max = 120 } = {}) => {
  if (typeof value !== "string") throw new AppError(`${label} is required`, 400);
  const trimmed = value.trim();
  if (trimmed.length < min) throw new AppError(`${label} is required`, 400);
  if (trimmed.length > max) throw new AppError(`${label} is too long (max ${max} characters)`, 400);
  return trimmed;
};

const parseDob = (value) => {
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new AppError("Date of birth must be a valid date", 400);
  }
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const birthdayPassed =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());
  if (!birthdayPassed) age -= 1;
  if (age < 18) throw new AppError("You must be at least 18 years old to open an account", 400);
  if (age > 110) throw new AppError("Enter a valid date of birth", 400);
  return date;
};

// POST /api/applications - the account opening form a customer fills in.
const createApplication = asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  if (!ACCOUNT_TYPES.includes(body.accountType)) {
    throw new AppError(`Account type must be one of: ${ACCOUNT_TYPES.join(", ")}`, 400);
  }
  const dob = parseDob(body.dob);
  const phone = requireString(body.phone, "Phone number", { max: 10 });
  if (!PHONE_PATTERN.test(phone)) {
    throw new AppError("Enter a valid 10-digit Indian mobile number", 400);
  }
  const pan = requireString(body.pan, "PAN", { max: 10 }).toUpperCase();
  if (!PAN_PATTERN.test(pan)) throw new AppError("Enter a valid PAN (e.g. ABCDE1234F)", 400);

  const address = body.address ?? {};
  const line1 = requireString(address.line1, "Address line 1");
  const city = requireString(address.city, "City", { max: 60 });
  const state = requireString(address.state, "State", { max: 60 });
  const pincode = requireString(address.pincode, "PIN code", { max: 6 });
  if (!PINCODE_PATTERN.test(pincode)) throw new AppError("Enter a valid 6-digit PIN code", 400);

  if (!OCCUPATIONS.includes(body.occupation)) {
    throw new AppError(`Occupation must be one of: ${OCCUPATIONS.join(", ")}`, 400);
  }
  if (!INCOME_BANDS.includes(body.annualIncome)) {
    throw new AppError(`Annual income must be one of: ${INCOME_BANDS.join(", ")}`, 400);
  }

  const nomineeName = requireString(body.nomineeName ?? "", "Nominee name", { min: 0, max: 80 });
  const nomineeRelation = requireString(
    body.nomineeRelation ?? "",
    "Nominee relation",
    { min: 0, max: 40 }
  );
  if (nomineeName && !nomineeRelation) {
    throw new AppError("Nominee relation is required when a nominee is named", 400);
  }

  const initialDepositRaw = body.initialDepositMinor ?? 0;
  const initialDepositMinor = initialDepositRaw === 0 ? 0 : parseAmountMinor(initialDepositRaw);

  const existingPending = await AccountApplication.findOne({
    user: req.user._id,
    status: "pending",
  });
  if (existingPending) {
    throw new AppError(
      `You already have a pending application (${existingPending.applicationNumber})`,
      409
    );
  }

  let application;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      application = await AccountApplication.create({
        user: req.user._id,
        applicationNumber: AccountApplication.generateApplicationNumber(),
        accountType: body.accountType,
        dob,
        phone,
        pan,
        address: { line1, city, state, pincode },
        occupation: body.occupation,
        annualIncome: body.annualIncome,
        nomineeName,
        nomineeRelation,
        initialDepositMinor,
      });
      break;
    } catch (error) {
      if (error.code === 11000 && attempt < 5) continue;
      throw error;
    }
  }

  return res.status(201).json({
    message: "Application submitted. The bank will review it shortly.",
    application,
  });
});

// GET /api/applications/mine - the signed-in customer's own applications.
const myApplications = asyncHandler(async (req, res) => {
  const applications = await AccountApplication.find({ user: req.user._id }).sort({
    createdAt: -1,
  });
  res.status(200).json({ applications });
});

// GET /api/applications - the staff review queue.
const listApplications = asyncHandler(async (req, res) => {
  const status = req.query.status;
  if (status !== undefined && !APPLICATION_STATUSES.includes(status)) {
    throw new AppError(`status must be one of: ${APPLICATION_STATUSES.join(", ")}`, 400);
  }
  const filter = status ? { status } : {};
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    const matchingUsers = await AccountApplication.db
      .model("User")
      .find({ $or: [{ name: pattern }, { email: pattern }] })
      .select("_id");
    filter.$or = [
      { user: { $in: matchingUsers.map((user) => user._id) } },
      { applicationNumber: pattern },
    ];
  }
  const limit = clampInt(req.query.limit, 50, 1, 200);
  const applications = await AccountApplication.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("user", "name email");
  res.status(200).json({ applications });
});

const findPendingApplication = async (id) => {
  if (typeof id !== "string" || !/^[0-9a-fA-F]{24}$/.test(id)) {
    throw new AppError("Application not found", 404);
  }
  const application = await AccountApplication.findById(id);
  if (!application) throw new AppError("Application not found", 404);
  if (application.status !== "pending") {
    throw new AppError(`This application has already been ${application.status}`, 409);
  }
  return application;
};

// PATCH /api/applications/:id/approve - creates the account (and first funding,
// if any) in one database transaction.
const approveApplication = asyncHandler(async (req, res) => {
  const application = await findPendingApplication(req.params.id);

  const openCount = await Account.countDocuments({
    user: application.user,
    status: { $ne: "closed" },
  });
  if (openCount >= MAX_ACCOUNTS_PER_USER) {
    throw new AppError("The applicant already has the maximum number of open accounts", 400);
  }

  let account;
  let transaction;
  await mongoose.connection.transaction(async (session) => {
    account = new Account({
      user: application.user,
      type: application.accountType,
      accountNumber: Account.generateAccountNumber(),
    });
    await account.save({ session });

    if (application.initialDepositMinor > 0) {
      const updated = await Account.findOneAndUpdate(
        { _id: account._id },
        { $inc: { balance: application.initialDepositMinor } },
        { returnDocument: "after", session }
      );
      [transaction] = await Transaction.create(
        [
          {
            account: account._id,
            user: account.user,
            initiatedBy: req.user._id,
            type: "deposit",
            amount: application.initialDepositMinor,
            balanceAfter: updated.balance,
            description: "Initial deposit",
          },
        ],
        { session }
      );
      account = updated;
    }

    application.status = "approved";
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    application.account = account._id;
    await application.save({ session });
  });

  await recordAudit({
    actor: req.user,
    action: "application.approve",
    targetType: "AccountApplication",
    targetId: application._id,
    summary: `Approved ${application.applicationNumber}; opened account ${account.accountNumber}`,
    req,
  });

  res.status(200).json({ message: "Application approved and account opened", application, account, transaction });
});

// PATCH /api/applications/:id/reject - remarks are required so the customer
// knows what to fix.
const rejectApplication = asyncHandler(async (req, res) => {
  const application = await findPendingApplication(req.params.id);
  const remarks = requireString(req.body?.remarks, "Remarks", { min: 3, max: 280 });

  application.status = "rejected";
  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();
  application.remarks = remarks;
  await application.save();

  await recordAudit({
    actor: req.user,
    action: "application.reject",
    targetType: "AccountApplication",
    targetId: application._id,
    summary: `Rejected ${application.applicationNumber}: ${remarks}`,
    req,
  });

  res.status(200).json({ message: "Application rejected", application });
});

module.exports = {
  createApplication,
  myApplications,
  listApplications,
  approveApplication,
  rejectApplication,
};
