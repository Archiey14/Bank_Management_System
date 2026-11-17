const mongoose = require("mongoose");

// Append-only activity log for a credit card: purchases raise the outstanding
// balance, repayments lower it. `amount` is always a positive number of minor
// units; `type` says which direction it moved.
const cardTransactionSchema = new mongoose.Schema(
  {
    card: { type: mongoose.Schema.Types.ObjectId, ref: "CreditCard", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["purchase", "repayment"], required: true },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => Number.isSafeInteger(value) && value > 0,
        message: "Amount must be a positive whole number of minor units",
      },
    },
    outstandingAfter: { type: Number, required: true, min: 0 },
    merchant: { type: String, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 140, default: "" },
    // Repayments: the bank account the money came from.
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    idempotencyKey: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

cardTransactionSchema.index({ card: 1, createdAt: -1 });
cardTransactionSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

module.exports = mongoose.model("CardTransaction", cardTransactionSchema);
