const crypto = require("crypto");
const mongoose = require("mongoose");
const { ACCOUNT_TYPES, APPLICATION_STATUSES, OCCUPATIONS, INCOME_BANDS } = require("../config/constants");

// A request to open an account, filled in by the customer and reviewed by
// staff. Approving it creates the Account (see applicationController).
const applicationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    applicationNumber: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    accountType: {
      type: String,
      enum: ACCOUNT_TYPES,
      required: [true, "Account type is required"],
    },
    dob: {
      type: Date,
      required: [true, "Date of birth is required"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"],
    },
    pan: {
      type: String,
      default: "DOC_ATTACHED",
      uppercase: true,
      trim: true,
    },
    address: {
      line1: { type: String, required: [true, "Address is required"], trim: true },
      city: { type: String, required: [true, "City is required"], trim: true },
      state: { type: String, required: [true, "State is required"], trim: true },
      pincode: {
        type: String,
        required: [true, "PIN code is required"],
        match: [/^\d{6}$/, "Enter a valid 6-digit PIN code"],
      },
    },
    occupation: {
      type: String,
      enum: OCCUPATIONS,
      required: [true, "Occupation is required"],
    },
    annualIncome: {
      type: String,
      enum: INCOME_BANDS,
      required: [true, "Annual income band is required"],
    },
    nomineeName: { type: String, trim: true, maxlength: 80, default: "" },
    nomineeRelation: { type: String, trim: true, maxlength: 40, default: "" },
    // Uploaded KYC documents (stored as compressed base64 data URLs)
    documents: {
      panCard: { type: String, default: "" },
      aadhaarCard: { type: String, default: "" },
      photograph: { type: String, default: "" },
      signature: { type: String, default: "" },
    },
    // Optional first funding, credited when staff approves the application.
    initialDepositMinor: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: (value) => Number.isSafeInteger(value),
        message: "Initial deposit must be a whole number of minor units",
      },
    },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: "pending",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    remarks: { type: String, trim: true, maxlength: 280, default: "" },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
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

applicationSchema.index({ user: 1, status: 1 });

applicationSchema.statics.generateApplicationNumber = function generateApplicationNumber() {
  return `APP-${crypto.randomInt(100_000, 1_000_000)}`;
};

module.exports = mongoose.model("AccountApplication", applicationSchema);
