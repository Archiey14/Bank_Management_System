const Account = require("../models/Account");
const Beneficiary = require("../models/Beneficiary");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

const ACCOUNT_NUMBER_PATTERN = /^\d{12}$/;

// GET /api/beneficiaries - the signed-in customer's saved payees.
const listBeneficiaries = asyncHandler(async (req, res) => {
  const beneficiaries = await Beneficiary.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json({ beneficiaries });
});

// POST /api/beneficiaries - save a payee. The account number must belong to an
// account at this bank.
const createBeneficiary = asyncHandler(async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (name.length < 2 || name.length > 60) {
    throw new AppError("Beneficiary name must be between 2 and 60 characters", 400);
  }
  const accountNumber =
    typeof req.body?.accountNumber === "string" ? req.body.accountNumber.trim() : "";
  if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
    throw new AppError("Enter a valid 12-digit account number", 400);
  }
  const nickname =
    typeof req.body?.nickname === "string" ? req.body.nickname.trim().slice(0, 40) : "";

  const account = await Account.findOne({ accountNumber });
  if (!account) throw new AppError("No account with that number exists at this bank", 404);

  const existing = await Beneficiary.findOne({ user: req.user._id, accountNumber });
  if (existing) {
    throw new AppError("This account number is already saved as a beneficiary", 409);
  }

  const beneficiary = await Beneficiary.create({
    user: req.user._id,
    name,
    accountNumber,
    nickname,
  });
  res.status(201).json({ message: "Beneficiary added", beneficiary });
});

// DELETE /api/beneficiaries/:id
const deleteBeneficiary = asyncHandler(async (req, res) => {
  const beneficiary = await Beneficiary.findOne({ _id: req.params.id, user: req.user._id });
  if (!beneficiary) throw new AppError("Beneficiary not found", 404);
  await beneficiary.deleteOne();
  res.status(200).json({ message: "Beneficiary removed" });
});

module.exports = { listBeneficiaries, createBeneficiary, deleteBeneficiary };
