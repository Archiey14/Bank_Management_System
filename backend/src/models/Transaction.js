const mongoose = require("mongoose");
const {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  REVIEW_STATUSES,
  MAX_DESCRIPTION_LENGTH,
} = require("../config/constants");

// Internal review fields. They are removed from normal API output so customers
// never see that a transfer was flagged; staff endpoints read them with lean().
const REVIEW_FIELDS = ["flagged", "flagReason", "reviewStatus", "reviewedBy", "reviewedAt", "reviewNote"];

// One row per account movement (an append-only ledger). A transfer creates two
// rows, a `transfer_out` and a `transfer_in`, that share a `transferId`.
const transactionSchema = new mongoose.Schema(
  {
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    // Owner of the account this row belongs to.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Who made the request (the customer, or a staff member acting for them).
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: true,
    },
    // Signed integer minor units: credits positive, debits negative.
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => Number.isSafeInteger(value) && value !== 0,
        message: "Amount must be a non-zero whole number of minor units",
      },
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      maxlength: MAX_DESCRIPTION_LENGTH,
      default: "",
    },
    status: {
      type: String,
      enum: TRANSACTION_STATUSES,
      default: "completed",
    },
    transferId: { type: String },
    counterpartyAccountNumber: { type: String },
    // True when both sides of a transfer belong to the same customer, so it
    // should not count as money in/out on their dashboard.
    isInternal: { type: Boolean, default: false },
    idempotencyKey: { type: String },
    // Bill payments.
    biller: { type: String },
    billReference: { type: String },
    // Staff review queue (large transfers).
    flagged: { type: Boolean, default: false },
    flagReason: { type: String },
    reviewStatus: { type: String, enum: REVIEW_STATUSES, default: "none" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 280 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        REVIEW_FIELDS.forEach((field) => delete ret[field]);
        return ret;
      },
    },
  }
);

transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ account: 1, createdAt: -1 });
transactionSchema.index({ transferId: 1 }, { sparse: true });
transactionSchema.index({ flagged: 1, reviewStatus: 1, createdAt: -1 });
transactionSchema.index(
  { initiatedBy: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

module.exports = mongoose.model("Transaction", transactionSchema);
