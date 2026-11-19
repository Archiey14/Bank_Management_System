const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Account = require("../models/Account");
const DebitCard = require("../models/DebitCard");
const DebitCardApplication = require("../models/DebitCardApplication");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { recordAudit } = require("../utils/audit");
const { sendCardApprovalEmail, sendCardRejectionEmail } = require("../services/emailService");
const { clampInt, escapeRegex, isObjectIdString } = require("../utils/validators");
const { generateCardLast4, cardExpiry } = require("../utils/cards");
const {
  APPLICATION_STATUSES,
  CARD_VALIDITY_YEARS,
  MAX_DEBIT_CARDS_PER_ACCOUNT,
} = require("../config/constants");

const ACCOUNT_FIELDS = "type accountNumber nickname status";

// POST /api/cards/debit-applications
const applyDebitCard = asyncHandler(async (req, res) => {
  const accountId = req.body?.accountId;
  if (!isObjectIdString(accountId)) {
    throw new AppError("Choose an account for the debit card", 400);
  }

  const account = await Account.findOne({ _id: accountId, user: req.user._id });
  if (!account) throw new AppError("Account not found", 404);
  if (account.status !== "active") {
    throw new AppError("Debit cards can only be requested for active accounts", 409);
  }
  if (account.type === "fixed_deposit") {
    throw new AppError("Debit cards are not available for fixed deposit accounts", 400);
  }

  const pending = await DebitCardApplication.findOne({
    user: req.user._id,
    account: account._id,
    status: "pending",
  });
  if (pending) {
    throw new AppError(
      `You already have a pending debit card application (${pending.applicationNumber}) for this account`,
      409
    );
  }

  const liveCards = await DebitCard.countDocuments({
    account: account._id,
    status: { $in: ["inactive", "active"] },
  });
  if (liveCards >= MAX_DEBIT_CARDS_PER_ACCOUNT) {
    throw new AppError(
      `This account already has ${MAX_DEBIT_CARDS_PER_ACCOUNT} live debit cards. Block one before requesting another.`,
      409
    );
  }

  let application;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      application = await DebitCardApplication.create({
        user: req.user._id,
        account: account._id,
        applicationNumber: DebitCardApplication.generateApplicationNumber(),
      });
      break;
    } catch (error) {
      if (error.code === 11000 && attempt < 5) continue;
      throw error;
    }
  }

  await application.populate("account", ACCOUNT_FIELDS);

  res.status(201).json({
    message: "Debit card application submitted. The bank will review it shortly.",
    application,
  });
});

// GET /api/cards/debit-applications/mine
const myDebitApplications = asyncHandler(async (req, res) => {
  const applications = await DebitCardApplication.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate("account", ACCOUNT_FIELDS);
  res.status(200).json({ applications });
});

// GET /api/cards/debit-applications - staff review queue
const listDebitApplications = asyncHandler(async (req, res) => {
  const status = req.query.status;
  if (status !== undefined && !APPLICATION_STATUSES.includes(status)) {
    throw new AppError(`status must be one of: ${APPLICATION_STATUSES.join(", ")}`, 400);
  }
  const filter = status ? { status } : {};

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    const users = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select("_id");
    filter.$or = [{ user: { $in: users.map((u) => u._id) } }, { applicationNumber: pattern }];
  }

  const limit = clampInt(req.query.limit, 50, 1, 200);
  const applications = await DebitCardApplication.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("user", "name email")
    .populate("account", ACCOUNT_FIELDS);
  res.status(200).json({ applications });
});

const findPendingDebitApplication = async (id) => {
  if (!isObjectIdString(id)) throw new AppError("Application not found", 404);
  const application = await DebitCardApplication.findById(id).populate("user", "name email");
  if (!application) throw new AppError("Application not found", 404);
  if (application.status !== "pending") {
    throw new AppError(`This application has already been ${application.status}`, 409);
  }
  return application;
};

// PATCH /api/cards/debit-applications/:id/approve - issues the card, generates
// a secure hexadecimal PIN, and emails it to the customer.
const approveDebitApplication = asyncHandler(async (req, res) => {
  const application = await findPendingDebitApplication(req.params.id);

  const account = await Account.findById(application.account);
  if (!account || account.status !== "active") {
    throw new AppError("The linked bank account is no longer active", 409);
  }

  const liveCards = await DebitCard.countDocuments({
    account: account._id,
    status: { $in: ["inactive", "active"] },
  });
  if (liveCards >= MAX_DEBIT_CARDS_PER_ACCOUNT) {
    throw new AppError(
      `This account already has the maximum of ${MAX_DEBIT_CARDS_PER_ACCOUNT} debit cards`,
      409
    );
  }

  // Generate 4-character random hexadecimal PIN (e.g. "A4F2", "8C1D")
  const generatedPin = crypto.randomBytes(2).toString("hex").toUpperCase();
  const pinHash = await bcrypt.hash(generatedPin, 10);
  const { expiryMonth, expiryYear } = cardExpiry(CARD_VALIDITY_YEARS);

  let card;
  await mongoose.connection.transaction(async (session) => {
    [card] = await DebitCard.create(
      [
        {
          user: application.user._id,
          account: account._id,
          application: application._id,
          last4: generateCardLast4(),
          expiryMonth,
          expiryYear,
          status: "active",
          pinHash,
          activatedAt: new Date(),
        },
      ],
      { session }
    );

    const claimed = await DebitCardApplication.findOneAndUpdate(
      { _id: application._id, status: "pending" },
      {
        $set: {
          status: "approved",
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          card: card._id,
        },
      },
      { returnDocument: "after", session }
    );
    if (!claimed) throw new AppError("This application has already been reviewed", 409);
  });

  // Send congratulatory approval email with generated PIN
  try {
    await sendCardApprovalEmail({
      to: application.user.email,
      recipientName: application.user.name,
      cardType: "debit",
      last4: card.last4,
      pin: generatedPin,
    });
  } catch (err) {
    // Non-blocking for response if email delivery fails in local dev
  }

  await recordAudit({
    actor: req.user,
    action: "debitcard.approve",
    targetType: "DebitCardApplication",
    targetId: application._id,
    summary: `Approved debit card application ${application.applicationNumber} for ${application.user.email}`,
    req,
  });

  const updated = await DebitCardApplication.findById(application._id)
    .populate("user", "name email")
    .populate("account", ACCOUNT_FIELDS);

  await card.populate("account", ACCOUNT_FIELDS);

  res.status(200).json({
    message: "Debit card approved and issued successfully. Approval email with PIN sent.",
    application: updated,
    card,
    generatedPin,
  });
});

// PATCH /api/cards/debit-applications/:id/reject
const rejectDebitApplication = asyncHandler(async (req, res) => {
  const application = await findPendingDebitApplication(req.params.id);
  const remarks = typeof req.body?.remarks === "string" ? req.body.remarks.trim() : "";
  if (remarks.length < 3 || remarks.length > 280) {
    throw new AppError("Remarks are required (3 to 280 characters)", 400);
  }

  const updated = await DebitCardApplication.findOneAndUpdate(
    { _id: application._id, status: "pending" },
    { $set: { status: "rejected", remarks, reviewedBy: req.user._id, reviewedAt: new Date() } },
    { returnDocument: "after" }
  )
    .populate("user", "name email")
    .populate("account", ACCOUNT_FIELDS);
  if (!updated) throw new AppError("This application has already been reviewed", 409);

  await recordAudit({
    actor: req.user,
    action: "debitcard.reject",
    targetType: "DebitCardApplication",
    targetId: application._id,
    summary: `Rejected debit card application ${application.applicationNumber}: ${remarks}`,
    req,
  });

  if (updated?.user?.email) {
    try {
      await sendCardRejectionEmail({
        to: updated.user.email,
        recipientName: updated.user.name,
        cardType: "debit",
        applicationNumber: application.applicationNumber,
        remarks,
      });
    } catch (err) {
      // Non-blocking in dev
    }
  }

  res.status(200).json({ message: "Debit card application rejected", application: updated });
});

module.exports = {
  applyDebitCard,
  myDebitApplications,
  listDebitApplications,
  approveDebitApplication,
  rejectDebitApplication,
};
