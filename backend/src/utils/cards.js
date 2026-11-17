const crypto = require("crypto");

const luhnCheckDigit = (digits) => {
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return String((10 - (sum % 10)) % 10);
};

// Builds a Luhn-valid 16-digit number and returns ONLY its last four digits.
// The full number is deliberately never stored or returned.
const generateCardLast4 = (prefix = "4") => {
  const body = prefix + String(crypto.randomInt(0, 10 ** 14)).padStart(14, "0");
  return (body + luhnCheckDigit(body)).slice(-4);
};

const cardExpiry = (years, from = new Date()) => ({
  expiryMonth: from.getMonth() + 1,
  expiryYear: from.getFullYear() + years,
});

// ₹ amount from minor units, for error messages.
const rupees = (minor) => `₹${(minor / 100).toLocaleString("en-IN")}`;

module.exports = { generateCardLast4, cardExpiry, rupees };
