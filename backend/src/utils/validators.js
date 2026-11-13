const AppError = require("./AppError");
const { MAX_DESCRIPTION_LENGTH } = require("../config/constants");

const isObjectIdString = (value) =>
  typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);

const isValidEmail = (value) => typeof value === "string" && /^\S+@\S+\.\S+$/.test(value);

// At least 6 characters with a letter, a number and a symbol.
const isStrongPassword = (password) =>
  typeof password === "string" &&
  password.length >= 6 &&
  /[A-Za-z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const PASSWORD_RULE_MESSAGE =
  "Password must be at least 6 characters long and contain at least one letter, one number, and one special symbol";

const cleanDescription = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") {
    throw new AppError("Description must be text", 400);
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new AppError(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`, 400);
  }
  return trimmed || fallback;
};

const clampInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const parseDateParam = (value, name) => {
  if (value === undefined) return null;
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new AppError(`${name} must be a valid date`, 400);
  }
  return date;
};

// Escapes user text so it can be used inside a RegExp (for search boxes).
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = {
  isObjectIdString,
  isValidEmail,
  isStrongPassword,
  PASSWORD_RULE_MESSAGE,
  cleanDescription,
  clampInt,
  parseDateParam,
  escapeRegex,
};
