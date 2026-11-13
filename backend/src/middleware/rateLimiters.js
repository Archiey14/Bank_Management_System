const rateLimit = require("express-rate-limit");

// Extra guard on routes that move money.
const moneyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  // Evaluated per request, so tests can set NODE_ENV after the app is loaded.
  skip: () => process.env.NODE_ENV === "test",
  message: { message: "Too many requests, please slow down" },
});

module.exports = { moneyLimiter };
