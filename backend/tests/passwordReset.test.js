const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("crypto");
const mongoose = require("mongoose");
const app = require("../server");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const { setTransporter } = require("../src/services/emailService");

describe("Password Reset & Email Delivery Suite", () => {
  let server;
  let baseUrl;
  const testRunId = Date.now();
  const testEmailDomain = `@reset-test-${testRunId}.com`;
  const registeredEmail = `alice${testEmailDomain}`;
  const initialPassword = "OldPassword123!";
  const newPassword = "NewStrongPass456!";

  const sentEmails = [];
  const mockTransporter = {
    shouldFail: false,
    sendMail: async (options) => {
      if (mockTransporter.shouldFail) {
        throw new Error("SMTP connection timeout");
      }
      sentEmails.push(options);
      return { messageId: "mock-message-id" };
    },
  };

  before(async () => {
    process.env.NODE_ENV = "test";
    setTransporter(mockTransporter);
    await connectDB();

    const user = new User({
      name: "Alice Reset",
      email: registeredEmail,
      password: initialPassword,
      role: "customer",
    });
    await user.save();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await User.deleteMany({ email: new RegExp(testEmailDomain) });
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  });

  it("1. Invalid email format returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.match(data.message, /valid email/i);
  });

  it("2. Forgot password with an unregistered email returns generic success without sending email", async () => {
    const beforeCount = sentEmails.length;
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `unregistered${testEmailDomain}` }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.match(data.message, /instructions have been sent/i);
    assert.equal(sentEmails.length, beforeCount);
  });

  it("3. Forgot password with a registered email sends reset email", async () => {
    const beforeCount = sentEmails.length;
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registeredEmail }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.match(data.message, /instructions have been sent/i);
    assert.equal(data.token, undefined);

    assert.equal(sentEmails.length, beforeCount + 1);
    const lastEmail = sentEmails[sentEmails.length - 1];
    assert.equal(lastEmail.to, registeredEmail);
    assert.equal(lastEmail.subject, "Reset Your Banking Management System Password");
    assert.match(lastEmail.html, /Reset Password/);
    assert.match(lastEmail.text, /15 minutes/);
  });

  it("4. Stores only hashed token in database with 15-minute expiration", async () => {
    const user = await User.findOne({ email: registeredEmail });
    assert.ok(user.resetPasswordToken);
    assert.ok(user.resetPasswordExpires);
    assert.equal(user.resetPasswordToken.length, 64);
    assert.ok(user.resetPasswordExpires.getTime() > Date.now());
    assert.ok(user.resetPasswordExpires.getTime() <= Date.now() + 15 * 60 * 1000 + 5000);
  });

  it("5. SMTP failure handling reverts token and returns 500", async () => {
    mockTransporter.shouldFail = true;

    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registeredEmail }),
    });

    mockTransporter.shouldFail = false;

    const data = await res.json();
    assert.equal(res.status, 500);
    assert.equal(data.success, false);
    assert.match(data.message, /failed to send/i);

    const user = await User.findOne({ email: registeredEmail });
    assert.equal(user.resetPasswordToken, null);
    assert.equal(user.resetPasswordExpires, null);
  });

  it("6. Reset with an invalid token returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/auth/reset-password/invalid-token-value`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: newPassword,
        confirmPassword: newPassword,
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.match(data.message, /invalid or has expired/i);
  });

  it("7. Reset with an expired token returns 400", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");

    await User.updateOne(
      { email: registeredEmail },
      {
        resetPasswordToken: hashed,
        resetPasswordExpires: new Date(Date.now() - 60000),
      }
    );

    const res = await fetch(`${baseUrl}/api/auth/reset-password/${rawToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: newPassword,
        confirmPassword: newPassword,
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.match(data.message, /invalid or has expired/i);
  });

  it("8. Password confirmation mismatch returns 400", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");

    await User.updateOne(
      { email: registeredEmail },
      {
        resetPasswordToken: hashed,
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
      }
    );

    const res = await fetch(`${baseUrl}/api/auth/reset-password/${rawToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: newPassword,
        confirmPassword: "MismatchPassword999!",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.match(data.message, /passwords do not match/i);
  });

  it("9. Weak password returns 400", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");

    await User.updateOne(
      { email: registeredEmail },
      {
        resetPasswordToken: hashed,
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
      }
    );

    const res = await fetch(`${baseUrl}/api/auth/reset-password/${rawToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: "short",
        confirmPassword: "short",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.match(data.message, /at least 6 characters/i);
  });

  it("10. Reset with a valid token successfully updates password and clears reset fields", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");

    await User.updateOne(
      { email: registeredEmail },
      {
        resetPasswordToken: hashed,
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
      }
    );

    const res = await fetch(`${baseUrl}/api/auth/reset-password/${rawToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: newPassword,
        confirmPassword: newPassword,
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.match(data.message, /successfully reset/i);
    assert.equal(data.token, undefined);

    const user = await User.findOne({ email: registeredEmail });
    assert.equal(user.resetPasswordToken, null);
    assert.equal(user.resetPasswordExpires, null);
    assert.notEqual(user.password, newPassword);
    assert.ok(user.password.startsWith("$2a$") || user.password.startsWith("$2b$"));
  });

  it("11. Attempt to reuse already-used token returns 400", async () => {
    const rawToken = "already-used-or-cleared-token";
    const res = await fetch(`${baseUrl}/api/auth/reset-password/${rawToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: newPassword,
        confirmPassword: newPassword,
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.match(data.message, /invalid or has expired/i);
  });

  it("12. Login succeeds with the new password and fails with old password", async () => {
    const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: registeredEmail,
        password: initialPassword,
      }),
    });
    assert.equal(oldLoginRes.status, 401);

    const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: registeredEmail,
        password: newPassword,
      }),
    });
    const newLoginData = await newLoginRes.json();
    assert.equal(newLoginRes.status, 200);
    assert.ok(newLoginData.token);
    assert.equal(newLoginData.user.email, registeredEmail);
    assert.equal(newLoginData.user.resetPasswordToken, undefined);
    assert.equal(newLoginData.user.resetPasswordExpires, undefined);
  });

  it("13. Reset token fields are never returned in user API responses", async () => {
    const meRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: registeredEmail,
        password: newPassword,
      }),
    });
    const { token } = await meRes.json();

    const profileRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const profileData = await profileRes.json();
    assert.equal(profileRes.status, 200);
    assert.equal(profileData.user.resetPasswordToken, undefined);
    assert.equal(profileData.user.resetPasswordExpires, undefined);
    assert.equal(profileData.user.password, undefined);
  });
});

