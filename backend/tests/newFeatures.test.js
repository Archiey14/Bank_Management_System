const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../server");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Account = require("../src/models/Account");
const Transaction = require("../src/models/Transaction");

describe("New Features Suite: Profile, Accounts, ATM Withdraw, Staff & Admin Management", () => {
  let server;
  let baseUrl;
  const runId = Date.now();
  const emailDomain = `@feat-test-${runId}.com`;

  let customerUser;
  let staffUser;
  let adminUser;
  let customerAccount;

  const call = async (method, path, { token, body, headers } = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data };
  };

  const makeUser = async (name, role) => {
    const email = `${name.toLowerCase()}${emailDomain}`;
    const user = await User.create({
      name,
      email,
      password: "Password123!",
      role,
      isEmailVerified: true,
      isActive: true,
    });
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "1h" }
    );
    return { user, token, id: user._id.toString(), email };
  };

  before(async () => {
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    customerUser = await makeUser("CustomerOne", "customer");
    staffUser = await makeUser("StaffMember", "staff");
    adminUser = await makeUser("AdminMaster", "admin");

    // Create an account for customer with 50,000 paise (500 INR)
    customerAccount = await Account.create({
      user: customerUser.user._id,
      type: "savings",
      accountNumber: Account.generateAccountNumber(),
      balance: 50000,
      nickname: "Initial Label",
    });
  });

  after(async () => {
    await Promise.all([
      User.deleteMany({ email: new RegExp(emailDomain) }),
      Account.deleteMany({ user: { $in: [customerUser.user._id, staffUser.user._id, adminUser.user._id] } }),
      Transaction.deleteMany({ user: customerUser.user._id }),
    ]);
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  });

  describe("Edit Profile Functionality", () => {
    it("1. customer can update name, phone and avatar", async () => {
      const res = await call("PATCH", "/api/auth/me", {
        token: customerUser.token,
        body: {
          name: "Customer Updated",
          phone: "+91 9999888877",
          avatar: "https://example.com/avatar1.png",
          role: "admin", // tamper attempt
        },
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.user.name, "Customer Updated");
      assert.equal(res.data.user.phone, "+91 9999888877");
      assert.equal(res.data.user.avatar, "https://example.com/avatar1.png");
      assert.equal(res.data.user.role, "customer"); // role tamper ignored
    });

    it("2. rejects invalid name or invalid phone number", async () => {
      const badName = await call("PATCH", "/api/auth/me", {
        token: customerUser.token,
        body: { name: "x" },
      });
      assert.equal(badName.status, 400);

      const badPhone = await call("PATCH", "/api/auth/me", {
        token: customerUser.token,
        body: { phone: "invalid phone string!!!" },
      });
      assert.equal(badPhone.status, 400);
    });
  });

  describe("Account Nickname Management", () => {
    it("3. customer can update their account nickname", async () => {
      const res = await call("PATCH", `/api/accounts/${customerAccount._id}`, {
        token: customerUser.token,
        body: { nickname: "Rainy Day Savings" },
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.account.nickname, "Rainy Day Savings");

      const check = await Account.findById(customerAccount._id);
      assert.equal(check.nickname, "Rainy Day Savings");
    });
  });

  describe("Customer ATM Withdrawal", () => {
    it("4. prevents withdrawals exceeding available balance (overdraft check)", async () => {
      const res = await call("POST", `/api/accounts/${customerAccount._id}/atm-withdraw`, {
        token: customerUser.token,
        body: { amountMinor: 9999999 },
      });
      assert.equal(res.status, 422);
      assert.match(res.data.message, /insufficient funds/i);
    });

    it("5. customer successfully withdraws funds within balance", async () => {
      const res = await call("POST", `/api/accounts/${customerAccount._id}/atm-withdraw`, {
        token: customerUser.token,
        body: { amountMinor: 10000, description: "ATM Cash" },
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.account.balance, 40000);
      assert.equal(res.data.transaction.type, "withdrawal");
      assert.equal(res.data.transaction.amount, -10000);
    });
  });

  describe("Staff Counter & Operations", () => {
    it("6. staff can open an account directly for customer", async () => {
      const res = await call("POST", "/api/staff/accounts", {
        token: staffUser.token,
        body: {
          customerEmail: customerUser.email,
          type: "current",
          nickname: "Staff Opened Current",
        },
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.account.type, "current");
      assert.equal(res.data.account.nickname, "Staff Opened Current");
    });

    it("7. staff can list flagged transfers and review them", async () => {
      // create a flagged transaction
      const flaggedTx = await Transaction.create({
        account: customerAccount._id,
        user: customerUser.user._id,
        initiatedBy: customerUser.user._id,
        type: "transfer_out",
        amount: -5000000,
        balanceAfter: 40000,
        flagged: true,
        flagReason: "High value transfer",
        reviewStatus: "pending",
      });

      const listRes = await call("GET", "/api/staff/flagged-transfers?status=pending", {
        token: staffUser.token,
      });
      assert.equal(listRes.status, 200);
      assert.ok(Array.isArray(listRes.data.transfers));

      const reviewRes = await call("PATCH", `/api/staff/flagged-transfers/${flaggedTx._id}/review`, {
        token: staffUser.token,
        body: { reviewStatus: "cleared", reviewNote: "Verified with customer" },
      });
      assert.equal(reviewRes.status, 200);
      assert.equal(reviewRes.data.transaction.reviewStatus, "cleared");
    });
  });

  describe("Admin Governance Suite", () => {
    it("8. non-admin users cannot access admin routes", async () => {
      const res = await call("GET", "/api/admin/users", { token: customerUser.token });
      assert.equal(res.status, 403);

      const staffRes = await call("GET", "/api/admin/users", { token: staffUser.token });
      assert.equal(staffRes.status, 403);
    });

    it("9. admin can view system reports", async () => {
      const res = await call("GET", "/api/admin/reports", { token: adminUser.token });
      assert.equal(res.status, 200);
      assert.ok(res.data.users.total >= 3);
      assert.ok(res.data.accounts.total >= 1);
    });

    it("10. admin can create staff accounts and list users", async () => {
      const newStaffEmail = `newofficer${emailDomain}`;
      const createRes = await call("POST", "/api/admin/users", {
        token: adminUser.token,
        body: {
          name: "Loan Officer",
          email: newStaffEmail,
          password: "OfficerPass123!",
          role: "staff",
        },
      });
      assert.equal(createRes.status, 201);
      assert.equal(createRes.data.user.role, "staff");

      const listRes = await call("GET", "/api/admin/users?role=staff", {
        token: adminUser.token,
      });
      assert.equal(listRes.status, 200);
      assert.ok(listRes.data.users.some((u) => u.email === newStaffEmail));
    });

    it("11. admin can deactivate and reactivate a user", async () => {
      const target = await User.findOne({ email: `newofficer${emailDomain}` });
      assert.ok(target);

      const deact = await call("PATCH", `/api/admin/users/${target._id}`, {
        token: adminUser.token,
        body: { isActive: false },
      });
      assert.equal(deact.status, 200);
      assert.equal(deact.data.user.isActive, false);

      const react = await call("PATCH", `/api/admin/users/${target._id}`, {
        token: adminUser.token,
        body: { isActive: true },
      });
      assert.equal(react.status, 200);
      assert.equal(react.data.user.isActive, true);
    });

    it("12. admin cannot deactivate their own account", async () => {
      const res = await call("PATCH", `/api/admin/users/${adminUser.id}`, {
        token: adminUser.token,
        body: { isActive: false },
      });
      assert.equal(res.status, 400);
      assert.match(res.data.message, /cannot deactivate your own account/i);
    });

    it("13. admin can read audit logs", async () => {
      const res = await call("GET", "/api/admin/audit-logs", {
        token: adminUser.token,
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.logs));
      assert.ok(res.data.logs.length > 0);
    });
  });
});
