const AppError = require("./AppError");
const Transaction = require("../models/Transaction");

const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/;

// Clients send an `Idempotency-Key` header with money-moving requests. If the
// same request is retried (double click, flaky network), the original result is
// returned instead of moving the money twice.
const readIdempotencyKey = (req) => {
  const raw = req.get("Idempotency-Key");
  if (raw === undefined || raw === "") return null;
  const key = raw.trim();
  if (!KEY_PATTERN.test(key)) {
    throw new AppError(
      "Idempotency-Key must be 8-128 characters using letters, numbers, and - _ . :",
      400
    );
  }
  return key;
};

const findPriorEntry = async (actorId, key) => {
  if (!key) return null;
  return Transaction.findOne({ initiatedBy: actorId, idempotencyKey: key });
};

module.exports = { readIdempotencyKey, findPriorEntry };
