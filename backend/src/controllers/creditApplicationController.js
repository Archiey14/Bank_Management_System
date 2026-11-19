const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Account = require("../models/Account");
const CreditCard = require("../models/CreditCard");
const CreditCardApplication = require("../models/CreditCardApplication");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { recordAudit } = require("../utils/audit");
const { sendCardApprovalEmail, sendCardRejectionEmail } = require("../services/emailService");
const { clampInt, escapeRegex, isObjectIdString } = require("../utils/validators");
const { generateCardLast4, cardExpiry, rupees } = require("../utils/cards");
const {
  APPLICATION_STATUSES,
  CARD_VALIDITY_YEARS,
  CREDIT_LIMIT_MIN_MINOR,
  CREDIT_LIMIT_MAX_MINOR,
  MAX_CREDIT_CARDS_PER_USER,
} = require("../config/constants");

const parseLimit = (value, label) => {
  if (
    !Number.isSafeInteger(value) ||
    value < CREDIT_LIMIT_MIN_MINOR ||
    value > CREDIT_LIMIT_MAX_MINOR
  ) {
    throw new AppError(
      `${label} must be between ${rupees(CREDIT_LIMIT_MIN_MINOR)} and ${rupees(CREDIT_LIMIT_MAX_MINOR)}`,
      400
    );
  }
  return value;
};

// POST /api/cards/credit-applications
const createCreditApplication = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const requestedLimit = parseLimit(body.requestedLimitMinor, "Requested credit limit");
  if (body.confirm !== true) {
    throw new AppError("Please confirm that your application details are accurate", 400);
  }

  const hasAccount = await Account.exists({ user: req.user._id, status: "active" });
  if (!hasAccount) {
    throw new AppError("Open a bank account before applying for a credit card", 403);
  }

  const pending = await CreditCardApplication.findOne({ user: req.user._id, status: "pending" });
  if (pending) {
    throw new AppError(`You already have a pending application (${pending.applicationNumber})`, 409);
  }
  const cardCount = await CreditCard.countDocuments({ user: req.user._id });
  if (cardCount >= MAX_CREDIT_CARDS_PER_USER) {
    throw new AppError(`You can hold at most ${MAX_CREDIT_CARDS_PER_USER} credit cards`, 409);
  }

  let application;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      application = await CreditCardApplication.create({
        user: req.user._id,
        applicationNumber: CreditCardApplication.generateApplicationNumber(),
        requestedLimit,
      });
      break;
    } catch (error) {
      if (error.code === 11000 && attempt < 5) continue;
      throw error;
    }
  }

  res.status(201).json({
    message: "Application submitted. The bank will review it shortly.",
    application,
  });
});

// GET /api/cards/credit-applications/mine
const myCreditApplications = asyncHandler(async (req, res) => {
  const applications = await CreditCardApplication.find({ user: req.user._id }).sort({
    createdAt: -1,
  });
  res.status(200).json({ applications });
});

// GET /api/cards/credit-applications - staff review queue.
const listCreditApplications = asyncHandler(async (req, res) => {
  const status = req.query.status;
  if (status !== undefined && !APPLICATION_STATUSES.includes(status)) {
    throw new AppError(`status must be one of: ${APPLICATION_STATUSES.join(", ")}`, 400);
  }
  const filter = status ? { status } : {};

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    const users = await CreditCardApplication.db
      .model("User")
      .find({ $or: [{ name: pattern }, { email: pattern }] })
      .select("_id");
    filter.$or = [{ user: { $in: users.map((u) => u._id) } }, { applicationNumber: pattern }];
  }

  const limit = clampInt(req.query.limit, 50, 1, 200);
  const applications = await CreditCardApplication.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("user", "name email");
  res.status(200).json({ applications });
});

const findPendingApplication = async (id) => {
  if (!isObjectIdString(id)) throw new AppError("Application not found", 404);
  const application = await CreditCardApplication.findById(id);
  if (!application) throw new AppError("Application not found", 404);
  if (application.status !== "pending") {
    throw new AppError(`This application has already been ${application.status}`, 409);
  }
  return application;
};

// PATCH /api/cards/credit-applications/:id/approve - issues the card. Staff may
// approve a different limit from the one requested.
const approveCreditApplication = asyncHandler(async (req, res) => {
  const application = await findPendingApplication(req.params.id);
  const approvedLimit =
    req.body?.approvedLimitMinor === undefined
      ? application.requestedLimit
      : parseLimit(req.body.approvedLimitMinor, "Approved credit limit");

  const cardCount = await CreditCard.countDocuments({ user: application.user });
  if (cardCount >= MAX_CREDIT_CARDS_PER_USER) {
    throw new AppError("The applicant already holds the maximum number of credit cards", 400);
  }

  // Generate 4-character random hexadecimal PIN (e.g. "A4F2", "8C1D")
  const generatedPin = crypto.randomBytes(2).toString("hex").toUpperCase();
  const pinHash = await bcrypt.hash(generatedPin, 10);

  let card;
  await mongoose.connection.transaction(async (session) => {
    const { expiryMonth, expiryYear } = cardExpiry(CARD_VALIDITY_YEARS);
    [card] = await CreditCard.create(
      [
        {
          user: application.user,
          application: application._id,
          last4: generateCardLast4(),
          expiryMonth,
          expiryYear,
          creditLimit: approvedLimit,
          pinHash,
        },
      ],
      { session }
    );

    // Claim the application atomically so two reviewers can't both approve it.
    const claimed = await CreditCardApplication.findOneAndUpdate(
      { _id: application._id, status: "pending" },
      {
        $set: {
          status: "approved",
          approvedLimit,
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          card: card._id,
        },
      },
      { returnDocument: "after", session }
    );
    if (!claimed) throw new AppError("This application has already been reviewed", 409);
  });

  const updated = await CreditCardApplication.findById(application._id).populate("user", "name email");

  // Send congratulatory approval email with generated PIN
  if (updated?.user?.email) {
    try {
      await sendCardApprovalEmail({
        to: updated.user.email,
        recipientName: updated.user.name,
        cardType: "credit",
        last4: card.last4,
        pin: generatedPin,
        limit: approvedLimit,
      });
    } catch (err) {
      // Non-blocking for response in local development
    }
  }

  await recordAudit({
    actor: req.user,
    action: "creditcard.approve",
    targetType: "CreditCardApplication",
    targetId: application._id,
    summary: `Approved ${application.applicationNumber} with a limit of ${rupees(approvedLimit)}`,
    req,
  });

  res.status(200).json({
    message: "Application approved and card issued with PIN. Approval email sent.",
    application: updated,
    card,
    generatedPin,
  });
});

// PATCH /api/cards/credit-applications/:id/reject
const rejectCreditApplication = asyncHandler(async (req, res) => {
  const application = await findPendingApplication(req.params.id);
  const remarks = typeof req.body?.remarks === "string" ? req.body.remarks.trim() : "";
  if (remarks.length < 3 || remarks.length > 280) {
    throw new AppError("Remarks are required (3 to 280 characters)", 400);
  }

  const updated = await CreditCardApplication.findOneAndUpdate(
    { _id: application._id, status: "pending" },
    { $set: { status: "rejected", remarks, reviewedBy: req.user._id, reviewedAt: new Date() } },
    { returnDocument: "after" }
  ).populate("user", "name email");
  if (!updated) throw new AppError("This application has already been reviewed", 409);

  await recordAudit({
    actor: req.user,
    action: "creditcard.reject",
    targetType: "CreditCardApplication",
    targetId: application._id,
    summary: `Rejected ${application.applicationNumber}: ${remarks}`,
    req,
  });

  if (updated?.user?.email) {
    try {
      await sendCardRejectionEmail({
        to: updated.user.email,
        recipientName: updated.user.name,
        cardType: "credit",
        applicationNumber: application.applicationNumber,
        remarks,
      });
    } catch (err) {
      // Non-blocking in dev
    }
  }

  res.status(200).json({ message: "Application rejected", application: updated });
});

module.exports = {
  createCreditApplication,
  myCreditApplications,
  listCreditApplications,
  approveCreditApplication,
  rejectCreditApplication,
};
