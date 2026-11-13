const Account = require("../models/Account");
const AppError = require("./AppError");
const { ACCOUNT_TYPES, MAX_ACCOUNTS_PER_USER } = require("../config/constants");

// Opens a new account for a user. Used for a customer opening their own account
// and for staff opening one on a customer's behalf.
const createAccountForUser = async (userId, type, { ownerIsCaller = true } = {}) => {
  if (!ACCOUNT_TYPES.includes(type)) {
    throw new AppError(`Account type must be one of: ${ACCOUNT_TYPES.join(", ")}`, 400);
  }

  const openCount = await Account.countDocuments({ user: userId, status: { $ne: "closed" } });
  if (openCount >= MAX_ACCOUNTS_PER_USER) {
    throw new AppError(
      ownerIsCaller
        ? `You can have at most ${MAX_ACCOUNTS_PER_USER} open accounts`
        : `This customer already has the maximum of ${MAX_ACCOUNTS_PER_USER} open accounts`,
      400
    );
  }

  // Account numbers are random, so retry in the rare case of a collision.
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await Account.create({
        user: userId,
        type,
        accountNumber: Account.generateAccountNumber(),
      });
    } catch (error) {
      if (error.code === 11000 && attempt < 5) continue;
      throw error;
    }
  }
  return undefined;
};

module.exports = { createAccountForUser };
