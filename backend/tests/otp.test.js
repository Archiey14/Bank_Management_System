const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  generateOtpCode,
  hashOtp,
  verifyOtp,
  OTP_LENGTH,
} = require("../src/utils/otp");

// Pure unit tests for the email one-time-password helpers. No database or
// server needed.
describe("Email OTP helpers", () => {
  it("generateOtpCode returns a zero-padded 6-digit string", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateOtpCode();
      assert.equal(code.length, OTP_LENGTH);
      assert.match(code, /^[0-9]{6}$/);
      assert.ok(Number.parseInt(code, 10) >= 0);
      assert.ok(Number.parseInt(code, 10) < 1_000_000);
    }
  });

  it("verifyOtp accepts the matching code and rejects everything else", () => {
    const code = generateOtpCode();
    const hash = hashOtp(code);
    assert.equal(verifyOtp(hash, code), true);
    assert.equal(verifyOtp(hash, "000000"), code === "000000");
    assert.equal(verifyOtp(hash, "12345"), false);
    assert.equal(verifyOtp(hash, "1234567"), false);
    assert.equal(verifyOtp(hash, ""), false);
    assert.equal(verifyOtp(hash, undefined), false);
    assert.equal(verifyOtp(null, code), false);
    assert.equal(verifyOtp("", code), false);
  });

  it("hashOtp is one-way and codes do not collide across attempts", () => {
    const a = generateOtpCode();
    const b = generateOtpCode();
    assert.notEqual(hashOtp(a), a);
    assert.match(hashOtp(a), /^[0-9a-f]{64}$/);
    if (a !== b) assert.notEqual(hashOtp(a), hashOtp(b));
  });

  it("verifyOtp is constant-time / length-aware (no throw on mismatched length)", () => {
    const hash = hashOtp("482910");
    // Different lengths must just return false, never throw.
    assert.equal(verifyOtp(hash, "abc"), false);
    assert.equal(verifyOtp(hash, "48291"), false);
    assert.equal(verifyOtp(hash, "4829100"), false);
  });
});
