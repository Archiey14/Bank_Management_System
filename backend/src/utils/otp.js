// Email one-time-password helpers for the second step of sign-in.
// Codes are 6 digits, hashed (SHA-256) at rest, expire after 5 minutes, and
// are verified with a constant-time comparison. Wrong attempts are counted
// and lock verification for 15 minutes after five misses.
const crypto = require("crypto");

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000; // codes live for 5 minutes
const MAX_OTP_FAILURES = 5;
const OTP_LOCK_MS = 15 * 60 * 1000;
// Purpose stamped on the short-lived token handed out after the password step.
// authMiddleware rejects any token that carries a `purpose`, so this token can
// only be exchanged at POST /api/auth/otp/verify and never works as a session.
const OTP_LOGIN_PURPOSE = "otp-login";

// A 6-digit string, zero-padded. crypto.randomInt is unbiased.
const generateOtpCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");

const hashOtp = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

// True only when a code matches the stored hash. The hash is one-shot: callers
// clear it after a success so the same code can never be reused.
const verifyOtp = (storedHash, code) => Boolean(storedHash) && safeEqual(storedHash, hashOtp(code));

module.exports = {
  OTP_LENGTH,
  OTP_TTL_MS,
  MAX_OTP_FAILURES,
  OTP_LOCK_MS,
  OTP_LOGIN_PURPOSE,
  generateOtpCode,
  hashOtp,
  verifyOtp,
};
