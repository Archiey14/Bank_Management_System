const crypto = require("crypto");
const mongoose = require("mongoose");
const { ACCOUNT_TYPES, ACCOUNT_STATUSES, CURRENCY } = require("../config/constants");

const accountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ACCOUNT_TYPES,
      required: [true, "Account type is required"],
    },
    accountNumber: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    currency: {
      type: String,
      default: CURRENCY,
      immutable: true,
    },
    // Integer minor units (paise/cents). Only changed through atomic $inc
    // updates inside a database transaction (see the controllers).
    balance: {
      type: Number,
      default: 0,
      min: [0, "Balance cannot be negative"],
      validate: {
        validator: Number.isSafeInteger,
        message: "Balance must be a whole number of minor units",
      },
    },
    status: {
      type: String,
      enum: ACCOUNT_STATUSES,
      default: "active",
    },
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

// 12-digit account number that never starts with 0.
accountSchema.statics.generateAccountNumber = function generateAccountNumber() {
  return String(crypto.randomInt(100_000_000_000, 1_000_000_000_000));
};

module.exports = mongoose.model("Account", accountSchema);
