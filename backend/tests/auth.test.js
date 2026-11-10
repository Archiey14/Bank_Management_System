const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../server");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");

describe("Authentication & Authorization Test Suite", () => {
  let server;
  let baseUrl;
  const testRunId = Date.now();
  const testEmailDomain = `@test-${testRunId}.com`;

  before(async () => {
    process.env.NODE_ENV = "test";
    await connectDB();
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

  it("1. Successful customer registration", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Customer",
        email: `customer1${testEmailDomain}`,
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.ok(data.token);
    assert.equal(data.user.email, `customer1${testEmailDomain}`);
    assert.equal(data.user.role, "customer");
    assert.equal(data.user.isActive, true);
  });

  it("2. Duplicate email registration", async () => {
    const payload = {
      name: "Duplicate User",
      email: `customer1${testEmailDomain}`,
      password: "Password123!",
      confirmPassword: "Password123!",
    };

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    assert.equal(res.status, 409);
    assert.match(data.message, /already registered/i);
  });

  it("3. Invalid email", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bad Email",
        email: "not-an-email",
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.match(data.message, /invalid email/i);
  });

  it("4. Weak password", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Weak Pass",
        email: `weak${testEmailDomain}`,
        password: "short",
        confirmPassword: "short",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.match(data.message, /at least 6 characters/i);
  });

  it("5. Password confirmation mismatch", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Mismatch Pass",
        email: `mismatch${testEmailDomain}`,
        password: "Password123!",
        confirmPassword: "Password999!",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.match(data.message, /passwords do not match/i);
  });

  it("6. Password is stored as a hash", async () => {
    const user = await User.findOne({ email: `customer1${testEmailDomain}` });
    assert.ok(user);
    assert.notEqual(user.password, "Password123!");
    assert.ok(user.password.startsWith("$2a$") || user.password.startsWith("$2b$"));
  });

  it("7. Successful login", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `customer1${testEmailDomain}`,
        password: "Password123!",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.token);
    assert.equal(data.user.email, `customer1${testEmailDomain}`);
  });

  it("8. Incorrect password", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `customer1${testEmailDomain}`,
        password: "WrongPassword123!",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.message, "Invalid email or password");
  });

  it("9. Nonexistent email", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `doesnotexist${testEmailDomain}`,
        password: "Password123!",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.message, "Invalid email or password");
  });

  it("10. Inactive account login", async () => {
    const inactiveUser = new User({
      name: "Inactive User",
      email: `inactive${testEmailDomain}`,
      password: "Password123!",
      isActive: false,
    });
    await inactiveUser.save();

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `inactive${testEmailDomain}`,
        password: "Password123!",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 403);
    assert.match(data.message, /inactive/i);
  });

  it("11. Successful authenticated /me request", async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `customer1${testEmailDomain}`,
        password: "Password123!",
      }),
    });
    const { token } = await loginRes.json();

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const meData = await meRes.json();
    assert.equal(meRes.status, 200);
    assert.equal(meData.user.email, `customer1${testEmailDomain}`);
  });

  it("12. Missing JWT", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    const data = await res.json();
    assert.equal(res.status, 401);
    assert.match(data.message, /token required/i);
  });

  it("13. Invalid JWT", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: "Bearer this.is.invalid" },
    });
    const data = await res.json();
    assert.equal(res.status, 401);
    assert.match(data.message, /invalid token/i);
  });

  it("14. Expired JWT", async () => {
    const user = await User.findOne({ email: `customer1${testEmailDomain}` });
    const expiredToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "-1s" }
    );

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const data = await res.json();
    assert.equal(res.status, 401);
    assert.match(data.message, /expired/i);
  });

  it("15. Deleted user token", async () => {
    const tempUser = new User({
      name: "Temporary User",
      email: `temp${testEmailDomain}`,
      password: "Password123!",
    });
    await tempUser.save();

    const token = jwt.sign(
      { id: tempUser._id, role: tempUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    await User.findByIdAndDelete(tempUser._id);

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    assert.equal(res.status, 401);
    assert.match(data.message, /user not found/i);
  });

  it("16. Customer cannot access admin-only routes", async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `customer1${testEmailDomain}`,
        password: "Password123!",
      }),
    });
    const { token } = await loginRes.json();

    const res = await fetch(`${baseUrl}/api/auth/admin-only`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    assert.equal(res.status, 403);
    assert.match(data.message, /forbidden/i);
  });

  it("17. Customer cannot register as admin or staff", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Attacker",
        email: `attacker${testEmailDomain}`,
        password: "Password123!",
        confirmPassword: "Password123!",
        role: "admin",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.user.role, "customer");
  });

  it("18. Staff/admin role authorization works", async () => {
    const adminUser = new User({
      name: "Admin User",
      email: `admin${testEmailDomain}`,
      password: "Password123!",
      role: "admin",
    });
    await adminUser.save();

    const staffUser = new User({
      name: "Staff User",
      email: `staff${testEmailDomain}`,
      password: "Password123!",
      role: "staff",
    });
    await staffUser.save();

    const adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const staffToken = jwt.sign(
      { id: staffUser._id, role: staffUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const adminToAdminRes = await fetch(`${baseUrl}/api/auth/admin-only`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminToAdminRes.status, 200);

    const staffToStaffRes = await fetch(`${baseUrl}/api/auth/staff-only`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(staffToStaffRes.status, 200);

    const staffToAdminRes = await fetch(`${baseUrl}/api/auth/admin-only`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(staffToAdminRes.status, 403);
  });

  it("19. Password hash is never returned in API responses", async () => {
    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Clean Response User",
        email: `clean${testEmailDomain}`,
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    });
    const registerData = await registerRes.json();
    assert.equal(registerData.user.password, undefined);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `clean${testEmailDomain}`,
        password: "Password123!",
      }),
    });
    const loginData = await loginRes.json();
    assert.equal(loginData.user.password, undefined);

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    const meData = await meRes.json();
    assert.equal(meData.user.password, undefined);
  });

  it("20. Existing health endpoint still works", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.status, "ok");
  });

  it("21. Logout endpoint works as expected for stateless JWT", async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.tokenStrategy);
    assert.ok(data.note);
  });
});

