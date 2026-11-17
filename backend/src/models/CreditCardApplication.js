const crypto = require("crypto");
const mongoose = require("mongoose");
const { APPLICATION_STATUSES } = require("../config/constants");

// A customer's request for a credit card. Staff review it; approval issues a
// CreditCard with the approved limit.
const creditCardApplicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    applicationNumber: { type: String, required: true, unique: true, immutable: true },
    requestedLimit: { type: Number, required: true, min: 1 },
    approvedLimit: { type: Number },
    status: { type: String, enum: APPLICATION_STATUSES, default: "pending" },
    remarks: { type: String, trim: true, maxlength: 280 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    card: { type: mongoose.Schema.Types.ObjectId, ref: "CreditCard" },
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

creditCardApplicationSchema.index({ status: 1, createdAt: -1 });

// "CCA-" followed by 8 digits.
creditCardApplicationSchema.statics.generateApplicationNumber = function generateApplicationNumber() {
  return `CCA-${crypto.randomInt(10_000_000, 100_000_000)}`;
};

module.exports = mongoose.model("CreditCardApplication", creditCardApplicationSchema);
