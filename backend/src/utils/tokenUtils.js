const jwt = require("jsonwebtoken");

// Short-lived token handed out after the password step. It carries the
// OTP_LOGIN_PURPOSE claim, so authMiddleware rejects it as a session token;
// it can only be exchanged at POST /auth/otp/verify.
const { OTP_LOGIN_PURPOSE } = require("./otp");

const generateToken = (payload, { expiresIn } = {}) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || "1d",
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = {
  OTP_LOGIN_PURPOSE,
  generateToken,
  verifyToken,
};
