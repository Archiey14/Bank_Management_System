const mongoose = require("mongoose");
const { FD_TENURES_MONTHS } = require("../config/constants");

// A fixed term deposit. Interest is simple, fixed at booking, and credited
// when the deposit is settled (at maturity or by an early break).
const fixedDepositSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sourceAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    creditAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    principalMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Principal must be a whole number of minor units",
      },
    },
    ratePercent: { type: Number, required: true },
    tenureMonths: {
      type: Number,
      required: true,
      enum: FD_TENURES_MONTHS,
    },
    interestMinor: { type: Number, required: true },
    maturityAmountMinor: { type: Number, required: true },
    openedAt: { type: Date, default: Date.now },
    maturityDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "settled"],
      default: "active",
      index: true,
    },
    settledAt: { type: Date, default: null },
    settlementAmountMinor: { type: Number, default: null },
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

fixedDepositSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("FixedDeposit", fixedDepositSchema);
