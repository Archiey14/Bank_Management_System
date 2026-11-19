const mongoose = require("mongoose");
const { CREDIT_CARD_STATUSES, CREDIT_BILLING_DAY } = require("../config/constants");

const wholeNumber = { validator: Number.isSafeInteger, message: "Must be a whole number of minor units" };

// A credit card issued when staff approve a CreditCardApplication. Amounts are
// integer minor units. `outstanding` only changes through atomic $inc updates
// inside a database transaction (purchases and repayments).
const creditCardSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: "CreditCardApplication" },
    last4: { type: String, required: true, match: [/^\d{4}$/, "Invalid card digits"] },
    expiryMonth: { type: Number, required: true, min: 1, max: 12 },
    expiryYear: { type: Number, required: true },
    creditLimit: { type: Number, required: true, min: 0, validate: wholeNumber },
    outstanding: { type: Number, default: 0, min: 0, validate: wholeNumber },
    status: { type: String, enum: CREDIT_CARD_STATUSES, default: "active" },
    billingDay: { type: Number, default: CREDIT_BILLING_DAY, min: 1, max: 28 },
    // Null when nothing is owed ("Not scheduled").
    dueDate: { type: Date, default: null },
    pinHash: { type: String, select: false },
    activatedAt: { type: Date, default: Date.now },
    blockedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        delete ret.pinHash;
        ret.availableCredit = Math.max(0, ret.creditLimit - ret.outstanding);
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("CreditCard", creditCardSchema);
