const mongoose = require("mongoose");

// A saved payee: someone the customer transfers to frequently. Only the
// account number is required to match a Northbank account.
const beneficiarySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Beneficiary name is required"],
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    accountNumber: {
      type: String,
      required: [true, "Account number is required"],
      match: [/^\d{12}$/, "Account number must be 12 digits"],
    },
    nickname: { type: String, trim: true, maxlength: 40, default: "" },
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

beneficiarySchema.index({ user: 1, accountNumber: 1 }, { unique: true });

module.exports = mongoose.model("Beneficiary", beneficiarySchema);
