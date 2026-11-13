const AppError = require("./AppError");
const { MAX_AMOUNT_MINOR } = require("../config/constants");

// The API sends and receives money as whole numbers of minor units
// (e.g. 25050 = 250.50). This keeps floating point out of the ledger.
const parseAmountMinor = (value) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new AppError(
      "amountMinor must be a whole number of minor units (for example paise or cents)",
      400
    );
  }
  if (value <= 0) {
    throw new AppError("Amount must be greater than zero", 400);
  }
  if (value > MAX_AMOUNT_MINOR) {
    throw new AppError("Amount exceeds the maximum allowed per transaction", 400);
  }
  return value;
};

module.exports = { parseAmountMinor };
