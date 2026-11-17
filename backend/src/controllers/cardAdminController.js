const CreditCard = require("../models/CreditCard");
const DebitCard = require("../models/DebitCard");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { recordAudit } = require("../utils/audit");
const { isObjectIdString } = require("../utils/validators");

// GET /api/cards/staff/blocked - every blocked card, so staff can release them.
const listBlockedCards = asyncHandler(async (req, res) => {
  const [debitCards, creditCards] = await Promise.all([
    DebitCard.find({ status: "blocked" })
      .sort({ blockedAt: -1 })
      .limit(200)
      .populate("user", "name email")
      .populate("account", "type accountNumber"),
    CreditCard.find({ status: "blocked" })
      .sort({ blockedAt: -1 })
      .limit(200)
      .populate("user", "name email"),
  ]);
  res.status(200).json({ debitCards, creditCards });
});

const requireStatus = (value) => {
  if (!["active", "blocked"].includes(value)) {
    throw new AppError('status must be "active" or "blocked"', 400);
  }
  return value;
};

// PATCH /api/cards/staff/debit/:id/status
// Releasing a card that was never activated returns it to "inactive" so the
// customer still has to set a PIN.
const setDebitCardStatus = asyncHandler(async (req, res) => {
  const status = requireStatus(req.body?.status);
  if (!isObjectIdString(req.params.id)) throw new AppError("Card not found", 404);
  const card = await DebitCard.findById(req.params.id);
  if (!card) throw new AppError("Card not found", 404);

  if (status === "blocked") {
    card.status = "blocked";
    card.blockedAt = new Date();
  } else {
    card.status = card.activatedAt ? "active" : "inactive";
    card.blockedAt = null;
  }
  await card.save();

  await recordAudit({
    actor: req.user,
    action: status === "blocked" ? "debitcard.block" : "debitcard.unblock",
    targetType: "DebitCard",
    targetId: card._id,
    summary: `${status === "blocked" ? "Blocked" : "Released"} debit card ending ${card.last4}`,
    req,
  });

  res.status(200).json({ message: status === "blocked" ? "Card blocked" : "Card released", card });
});

// PATCH /api/cards/staff/credit/:id/status
const setCreditCardStatus = asyncHandler(async (req, res) => {
  const status = requireStatus(req.body?.status);
  if (!isObjectIdString(req.params.id)) throw new AppError("Card not found", 404);
  const card = await CreditCard.findById(req.params.id);
  if (!card) throw new AppError("Card not found", 404);

  card.status = status;
  card.blockedAt = status === "blocked" ? new Date() : null;
  await card.save();

  await recordAudit({
    actor: req.user,
    action: status === "blocked" ? "creditcard.block" : "creditcard.unblock",
    targetType: "CreditCard",
    targetId: card._id,
    summary: `${status === "blocked" ? "Blocked" : "Released"} credit card ending ${card.last4}`,
    req,
  });

  res.status(200).json({ message: status === "blocked" ? "Card blocked" : "Card released", card });
});

module.exports = { listBlockedCards, setDebitCardStatus, setCreditCardStatus };
