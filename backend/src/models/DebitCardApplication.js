const crypto = require("crypto");
const mongoose = require("mongoose");
const { APPLICATION_STATUSES } = require("../config/constants");

// A customer's request for a debit card linked to one of their bank accounts.
// Bank staff review and approve it; approval issues the card with a generated
// hexadecimal PIN and sends an email notification.
const debitCardApplicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    applicationNumber: { type: String, required: true, unique: true, immutable: true },
    status: { type: String, enum: APPLICATION_STATUSES, default: "pending" },
    remarks: { type: String, trim: true, maxlength: 280 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    card: { type: mongoose.Schema.Types.ObjectId, ref: "DebitCard" },
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

debitCardApplicationSchema.index({ status: 1, createdAt: -1 });

// "DCA-" followed by 8 digits.
debitCardApplicationSchema.statics.generateApplicationNumber = function generateApplicationNumber() {
  return `DCA-${crypto.randomInt(10_000_000, 100_000_000)}`;
};

module.exports = mongoose.model("DebitCardApplication", debitCardApplicationSchema);
