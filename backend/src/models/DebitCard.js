const mongoose = require("mongoose");
const { DEBIT_CARD_STATUSES, DEBIT_ATM_LIMIT_DEFAULT_MINOR } = require("../config/constants");

// A debit card is linked to one savings/current account. Only the last four
// digits are stored (the full number is never kept), and the PIN is stored as a
// bcrypt hash that is never sent to the client.
const debitCardSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: "DebitCardApplication" },
    last4: { type: String, required: true, match: [/^\d{4}$/, "Invalid card digits"] },
    expiryMonth: { type: Number, required: true, min: 1, max: 12 },
    expiryYear: { type: Number, required: true },
    // inactive: issued but not yet activated. blocked cards can only be
    // released by bank staff.
    status: { type: String, enum: DEBIT_CARD_STATUSES, default: "inactive" },
    // Integer minor units.
    dailyAtmLimit: {
      type: Number,
      default: DEBIT_ATM_LIMIT_DEFAULT_MINOR,
      min: 0,
      validate: { validator: Number.isSafeInteger, message: "Limit must be a whole number" },
    },
    pinHash: { type: String, select: false },
    issuedAt: { type: Date, default: Date.now },
    activatedAt: { type: Date, default: null },
    blockedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        delete ret.pinHash;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("DebitCard", debitCardSchema);
