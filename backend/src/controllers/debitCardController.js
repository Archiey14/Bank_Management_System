const bcrypt = require("bcryptjs");
const Account = require("../models/Account");
const DebitCard = require("../models/DebitCard");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { isObjectIdString } = require("../utils/validators");
const { generateCardLast4, cardExpiry, rupees } = require("../utils/cards");
const {
  CARD_VALIDITY_YEARS,
  MAX_DEBIT_CARDS_PER_ACCOUNT,
  DEBIT_ATM_LIMIT_MIN_MINOR,
  DEBIT_ATM_LIMIT_MAX_MINOR,
} = require("../config/constants");

const ACCOUNT_FIELDS = "type accountNumber nickname status";
const BLOCKED_MESSAGE = "This card is blocked. Contact bank support if you need assistance.";
const WEAK_PINS = new Set(["1234", "4321", "0123", "3210", "2580"]);

const findOwnCard = async (id, userId) => {
  if (!isObjectIdString(id)) throw new AppError("Card not found", 404);
  const card = await DebitCard.findOne({ _id: id, user: userId });
  if (!card) throw new AppError("Card not found", 404);
  return card;
};

// GET /api/cards/debit
const listDebitCards = asyncHandler(async (req, res) => {
  const cards = await DebitCard.find({ user: req.user._id })
    .sort({ createdAt: -1, _id: -1 })
    .populate("account", ACCOUNT_FIELDS);
  res.status(200).json({ cards });
});

// POST /api/cards/debit - issue a new (inactive) card for one of the
// customer's accounts.
const requestDebitCard = asyncHandler(async (req, res) => {
  const accountId = req.body?.accountId;
  if (!isObjectIdString(accountId)) throw new AppError("Choose an account for the card", 400);

  const account = await Account.findOne({ _id: accountId, user: req.user._id });
  if (!account) throw new AppError("Account not found", 404);
  if (account.status !== "active") {
    throw new AppError("Cards can only be issued for active accounts", 409);
  }
  if (account.type === "fixed_deposit") {
    throw new AppError("Debit cards are not available for fixed deposit accounts", 400);
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

  const { expiryMonth, expiryYear } = cardExpiry(CARD_VALIDITY_YEARS);
  const card = await DebitCard.create({
    user: req.user._id,
    account: account._id,
    last4: generateCardLast4(),
    expiryMonth,
    expiryYear,
  });
  await card.populate("account", ACCOUNT_FIELDS);

  res.status(201).json({ message: "Debit card issued. Activate it to start using it.", card });
});

// POST /api/cards/debit/:id/activate - the customer chooses a 4-digit PIN.
const activateDebitCard = asyncHandler(async (req, res) => {
  const pin = req.body?.pin;
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    throw new AppError("Choose a 4-digit PIN", 400);
  }
  if (/^(\d)\1{3}$/.test(pin) || WEAK_PINS.has(pin)) {
    throw new AppError("Choose a PIN that is harder to guess", 400);
  }

  const card = await findOwnCard(req.params.id, req.user._id);
  if (card.status === "blocked") throw new AppError(BLOCKED_MESSAGE, 409);
  if (card.status === "active") throw new AppError("This card is already active", 409);

  const pinHash = await bcrypt.hash(pin, 10);
  const updated = await DebitCard.findOneAndUpdate(
    { _id: card._id, user: req.user._id, status: "inactive" },
    { $set: { status: "active", activatedAt: new Date(), pinHash } },
    { returnDocument: "after" }
  ).populate("account", ACCOUNT_FIELDS);
  if (!updated) throw new AppError("This card could not be activated", 409);

  res.status(200).json({ message: "Card activated", card: updated });
});

// PATCH /api/cards/debit/:id/limit
const setDebitCardLimit = asyncHandler(async (req, res) => {
  const limit = req.body?.dailyAtmLimitMinor;
  if (
    !Number.isSafeInteger(limit) ||
    limit < DEBIT_ATM_LIMIT_MIN_MINOR ||
    limit > DEBIT_ATM_LIMIT_MAX_MINOR
  ) {
    throw new AppError(
      `Daily ATM limit must be between ${rupees(DEBIT_ATM_LIMIT_MIN_MINOR)} and ${rupees(DEBIT_ATM_LIMIT_MAX_MINOR)}`,
      400
    );
  }

  const card = await findOwnCard(req.params.id, req.user._id);
  if (card.status === "blocked") throw new AppError(BLOCKED_MESSAGE, 409);

  card.dailyAtmLimit = limit;
  await card.save();
  await card.populate("account", ACCOUNT_FIELDS);

  res.status(200).json({ message: "Daily ATM limit updated", card });
});

// POST /api/cards/debit/:id/block - customers can block; only staff can release.
const blockDebitCard = asyncHandler(async (req, res) => {
  const card = await findOwnCard(req.params.id, req.user._id);
  const updated = await DebitCard.findOneAndUpdate(
    { _id: card._id, user: req.user._id, status: { $ne: "blocked" } },
    { $set: { status: "blocked", blockedAt: new Date() } },
    { returnDocument: "after" }
  ).populate("account", ACCOUNT_FIELDS);
  if (!updated) throw new AppError("This card is already blocked", 409);

  res.status(200).json({ message: "Card blocked", card: updated });
});

module.exports = {
  listDebitCards,
  requestDebitCard,
  activateDebitCard,
  setDebitCardLimit,
  blockDebitCard,
};
