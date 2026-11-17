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
const AccountApplication = require("../src/models/AccountApplication");
const Beneficiary = require("../src/models/Beneficiary");
const FixedDeposit = require("../src/models/FixedDeposit");

// Account applications, beneficiaries, fixed deposits and staff operations.
// These tests move money through real database transactions, so MONGODB_URI
// must point at a replica set. Use a dedicated test database.

describe("Advanced: applications, beneficiaries, fixed deposits and staff ops", () => {
  let server;
  let baseUrl;
  const runId = Date.now();
  const emailDomain = `@advanced-test-${runId}.com`;

  let customer;
  let applicant;
  let other;
  let staff;
  let savings;
  let otherAccount;

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
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  const register = async (label) => {
    const res = await call("POST", "/api/auth/register", {
      body: {
        name: `Advanced ${label}`,
        email: `${label}${emailDomain}`,
        password: "Password123!",
        confirmPassword: "Password123!",
      },
    });
    assert.equal(res.status, 201);
    return { id: res.data.user._id, token: res.data.token };
  };

  const openAccount = async (who, type = "savings") => {
    const res = await call("POST", "/api/staff/accounts", {
      token: staff.token,
      body: { customerId: who.id, type },
    });
    assert.equal(res.status, 201);
    return res.data.account;
  };

  const deposit = async (who, accountId, amountMinor) => {
    const res = await call("POST", `/api/accounts/${accountId}/deposit`, {
      token: who.token,
      body: { amountMinor, description: "Test funding" },
    });
    assert.equal(res.status, 201);
    return res.data;
  };

  const validApplication = (overrides = {}) => ({
    accountType: "current",
    dob: "1990-05-15",
    phone: "9876543210",
    pan: "ABCDE1234F",
    address: {
      line1: "42 Test Street",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    },
    occupation: "Salaried",
    annualIncome: "2l_to_5l",
    nomineeName: "Test Nominee",
    nomineeRelation: "Spouse",
    initialDepositMinor: 50000,
    ...overrides,
  });

  before(async () => {
    process.env.NODE_ENV = "test";
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    customer = await register("customer");
    applicant = await register("applicant");
    other = await register("other");

    const staffUser = new User({
      name: "Advanced Staff",
      email: `staff${emailDomain}`,
      password: "Password123!",
      role: "staff",
    });
    await staffUser.save();
    staff = {
      id: String(staffUser._id),
      token: jwt.sign({ id: staffUser._id, role: "staff" }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      }),
    };

    savings = await openAccount(customer);
    otherAccount = await openAccount(other);
  });

  after(async () => {
    const users = await User.find({ email: new RegExp(emailDomain) }).select("_id");
    const ids = users.map((user) => user._id);
    await FixedDeposit.deleteMany({ user: { $in: ids } });
    await Beneficiary.deleteMany({ user: { $in: ids } });
    await AccountApplication.deleteMany({ user: { $in: ids } });
    await Transaction.deleteMany({ user: { $in: ids } });
    await Account.deleteMany({ user: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  });

  describe("account applications", () => {
    let applicationId;
    let applicationNumber;

    it("1. requires authentication", async () => {
      assert.equal((await call("POST", "/api/applications", { body: {} })).status, 401);
      assert.equal((await call("GET", "/api/applications/mine")).status, 401);
    });

    it("2. rejects invalid form details", async () => {
      const badPan = await call("POST", "/api/applications", {
        token: applicant.token,
        body: validApplication({ pan: "not-a-pan" }),
      });
      assert.equal(badPan.status, 400);

      const underage = await call("POST", "/api/applications", {
        token: applicant.token,
        body: validApplication({ dob: "2015-01-01" }),
      });
      assert.equal(underage.status, 400);

      const badPhone = await call("POST", "/api/applications", {
        token: applicant.token,
        body: validApplication({ phone: "12345" }),
      });
      assert.equal(badPhone.status, 400);

      const nomineeWithoutRelation = await call("POST", "/api/applications", {
        token: applicant.token,
        body: validApplication({ nomineeRelation: "" }),
      });
      assert.equal(nomineeWithoutRelation.status, 400);
    });

    it("3. submits a valid application", async () => {
      const res = await call("POST", "/api/applications", {
        token: applicant.token,
        body: validApplication(),
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.application.status, "pending");
      assert.match(res.data.application.applicationNumber, /^APP-\d{6}$/);
      applicationId = res.data.application._id;
      applicationNumber = res.data.application.applicationNumber;
    });

    it("4. allows only one pending application per customer", async () => {
      const res = await call("POST", "/api/applications", {
        token: applicant.token,
        body: validApplication({ accountType: "savings" }),
      });
      assert.equal(res.status, 409);
    });

    it("5. customers can see their own applications but not the queue", async () => {
      const mine = await call("GET", "/api/applications/mine", { token: applicant.token });
      assert.equal(mine.status, 200);
      assert.equal(mine.data.applications.length, 1);
      assert.equal(mine.data.applications[0].applicationNumber, applicationNumber);

      assert.equal((await call("GET", "/api/applications", { token: applicant.token })).status, 403);
    });

    it("6. staff can list and search the queue", async () => {
      const all = await call("GET", "/api/applications", { token: staff.token });
      assert.equal(all.status, 200);
      assert.ok(all.data.applications.some((a) => a.applicationNumber === applicationNumber));

      const pending = await call("GET", "/api/applications?status=pending", { token: staff.token });
      assert.equal(pending.status, 200);
      assert.ok(pending.data.applications.every((a) => a.status === "pending"));

      const searched = await call("GET", `/api/applications?q=${applicationNumber}`, {
        token: staff.token,
      });
      assert.ok(searched.data.applications.some((a) => a.applicationNumber === applicationNumber));
    });

    it("7. rejecting without remarks fails; with remarks it works", async () => {
      const noRemarks = await call("PATCH", `/api/applications/${applicationId}/reject`, {
        token: staff.token,
        body: {},
      });
      assert.equal(noRemarks.status, 400);

      const res = await call("PATCH", `/api/applications/${applicationId}/reject`, {
        token: staff.token,
        body: { remarks: "PAN copy is unreadable, please re-apply." },
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.application.status, "rejected");
      assert.ok(res.data.application.remarks.length > 0);

      const again = await call("PATCH", `/api/applications/${applicationId}/approve`, {
        token: staff.token,
      });
      assert.equal(again.status, 409);
    });

    it("8. approving opens the account and credits the initial deposit", async () => {
      const created = await call("POST", "/api/applications", {
        token: applicant.token,
        body: validApplication({ initialDepositMinor: 75000 }),
      });
      assert.equal(created.status, 201);

      const approved = await call("PATCH", `/api/applications/${created.data.application._id}/approve`, {
        token: staff.token,
      });
      assert.equal(approved.status, 200);
      assert.equal(approved.data.application.status, "approved");
      assert.equal(approved.data.account.balance, 75000);
      assert.equal(approved.data.account.type, "current");
      assert.ok(approved.data.transaction);

      const mine = await call("GET", "/api/accounts", { token: applicant.token });
      assert.ok(mine.data.accounts.some((a) => a._id === approved.data.account._id));
    });
  });

  describe("beneficiaries", () => {
    let beneficiaryId;

    it("1. rejects unknown account numbers", async () => {
      const res = await call("POST", "/api/beneficiaries", {
        token: customer.token,
        body: { name: "Test Friend", accountNumber: "999999999999" },
      });
      assert.equal(res.status, 404);
    });

    it("2. adds, lists and removes a beneficiary", async () => {
      const created = await call("POST", "/api/beneficiaries", {
        token: customer.token,
        body: { name: "Other Customer", accountNumber: otherAccount.accountNumber, nickname: "Flatmate" },
      });
      assert.equal(created.status, 201);
      beneficiaryId = created.data.beneficiary._id;

      const duplicate = await call("POST", "/api/beneficiaries", {
        token: customer.token,
        body: { name: "Other Again", accountNumber: otherAccount.accountNumber },
      });
      assert.equal(duplicate.status, 409);

      const listed = await call("GET", "/api/beneficiaries", { token: customer.token });
      assert.equal(listed.data.beneficiaries.length, 1);
      assert.equal(listed.data.beneficiaries[0].accountNumber, otherAccount.accountNumber);

      const removed = await call("DELETE", `/api/beneficiaries/${beneficiaryId}`, {
        token: customer.token,
      });
      assert.equal(removed.status, 200);

      const gone = await call("DELETE", `/api/beneficiaries/${beneficiaryId}`, {
        token: customer.token,
      });
      assert.equal(gone.status, 404);
    });
  });

  describe("fixed deposits", () => {
    let fixedDepositId;

    it("1. validates amount and tenure", async () => {
      const tooSmall = await call("POST", "/api/fixed-deposits", {
        token: customer.token,
        body: { sourceAccountId: savings._id, principalMinor: 50000, tenureMonths: 12 },
      });
      assert.equal(tooSmall.status, 400);

      const badTenure = await call("POST", "/api/fixed-deposits", {
        token: customer.token,
        body: { sourceAccountId: savings._id, principalMinor: 2000000, tenureMonths: 9 },
      });
      assert.equal(badTenure.status, 400);
    });

    it("2. booking without funds fails without changing anything", async () => {
      const res = await call("POST", "/api/fixed-deposits", {
        token: customer.token,
        body: { sourceAccountId: savings._id, principalMinor: 2000000, tenureMonths: 12 },
      });
      assert.equal(res.status, 422);

      const account = await call("GET", `/api/accounts/${savings._id}`, { token: customer.token });
      assert.equal(account.data.account.balance, 0);
    });

    it("3. books a deposit, moving the principal out of the account", async () => {
      await deposit(customer, savings._id, 1500000);

      const key = `fd-test-${runId}`;
      const book = await call("POST", "/api/fixed-deposits", {
        token: customer.token,
        headers: { "Idempotency-Key": key },
        body: { sourceAccountId: savings._id, principalMinor: 1200000, tenureMonths: 12 },
      });
      assert.equal(book.status, 201);
      // 6.5% p.a. simple interest on 12,000.00 for 12 months = 780.00
      assert.equal(book.data.fixedDeposit.interestMinor, 78000);
      assert.equal(book.data.fixedDeposit.maturityAmountMinor, 1278000);
      fixedDepositId = book.data.fixedDeposit._id;

      const account = await call("GET", `/api/accounts/${savings._id}`, { token: customer.token });
      assert.equal(account.data.account.balance, 300000);

      // Retrying with the same key pays out the original result, not a new booking.
      const replay = await call("POST", "/api/fixed-deposits", {
        token: customer.token,
        headers: { "Idempotency-Key": key },
        body: { sourceAccountId: savings._id, principalMinor: 1200000, tenureMonths: 12 },
      });
      assert.equal(replay.status, 200);
      assert.equal(replay.data.replayed, true);

      const still = await call("GET", `/api/accounts/${savings._id}`, { token: customer.token });
      assert.equal(still.data.account.balance, 300000);
    });

    it("4. lists deposits with an early-break payout preview", async () => {
      const res = await call("GET", "/api/fixed-deposits", { token: customer.token });
      assert.equal(res.status, 200);
      assert.equal(res.data.fixedDeposits.length, 1);
      const fd = res.data.fixedDeposits[0];
      assert.equal(fd.status, "active");
      assert.equal(fd.preview.matured, false);
      // Early break: principal + pro-rata interest - 1% penalty on principal.
      // Interest for 0 days held is 0, so payout = 1,200,000 - 12,000.
      assert.equal(fd.preview.accruedMinor, 0);
      assert.equal(fd.preview.penaltyMinor, 12000);
      assert.equal(fd.preview.settlementMinor, 1188000);
    });

    it("5. settling pays out once and cannot be repeated", async () => {
      const settled = await call("POST", `/api/fixed-deposits/${fixedDepositId}/settle`, {
        token: customer.token,
      });
      assert.equal(settled.status, 200);
      assert.equal(settled.data.fixedDeposit.status, "settled");
      assert.equal(settled.data.fixedDeposit.settlementAmountMinor, 1188000);

      const account = await call("GET", `/api/accounts/${savings._id}`, { token: customer.token });
      assert.equal(account.data.account.balance, 300000 + 1188000);

      const again = await call("POST", `/api/fixed-deposits/${fixedDepositId}/settle`, {
        token: customer.token,
      });
      assert.equal(again.status, 409);

      const ledger = await call("GET", "/api/transactions?type=fd_credit", {
        token: customer.token,
      });
      assert.equal(ledger.data.transactions.length, 1);
      assert.equal(ledger.data.transactions[0].amount, 1188000);
    });
  });

  describe("staff operations", () => {
    it("1. the overview is staff-only and includes the application queue", async () => {
      assert.equal((await call("GET", "/api/staff/overview", { token: customer.token })).status, 403);

      const res = await call("GET", "/api/staff/overview", { token: staff.token });
      assert.equal(res.status, 200);
      assert.ok(res.data.totals.customers >= 3);
      assert.ok(res.data.totals.openAccounts >= 2);
      assert.ok(res.data.daily.length > 0);
      assert.equal(typeof res.data.pendingApplications, "number");
    });

    it("2. customers cannot freeze accounts; staff can", async () => {
      const forbidden = await call("PATCH", `/api/accounts/${savings._id}/status`, {
        token: customer.token,
        body: { status: "frozen" },
      });
      assert.equal(forbidden.status, 403);

      const frozen = await call("PATCH", `/api/accounts/${savings._id}/status`, {
        token: staff.token,
        body: { status: "frozen" },
      });
      assert.equal(frozen.status, 200);
      assert.equal(frozen.data.account.status, "frozen");

      const blocked = await call("POST", "/api/transfers", {
        token: customer.token,
        body: {
          fromAccountId: savings._id,
          toAccountNumber: otherAccount.accountNumber,
          amountMinor: 1000,
        },
      });
      assert.equal(blocked.status, 409);

      const unfrozen = await call("PATCH", `/api/accounts/${savings._id}/status`, {
        token: staff.token,
        body: { status: "active" },
      });
      assert.equal(unfrozen.status, 200);
      assert.equal(unfrozen.data.account.status, "active");

      const works = await call("POST", "/api/transfers", {
        token: customer.token,
        body: {
          fromAccountId: savings._id,
          toAccountNumber: otherAccount.accountNumber,
          amountMinor: 1000,
        },
      });
      assert.equal(works.status, 201);
    });

    it("3. rejects unknown status values", async () => {
      const res = await call("PATCH", `/api/accounts/${savings._id}/status`, {
        token: staff.token,
        body: { status: "closed" },
      });
      assert.equal(res.status, 400);
    });

    it("4. lists the customer directory with owners, filterable by status", async () => {
      const forbidden = await call("GET", "/api/staff/accounts", { token: customer.token });
      assert.equal(forbidden.status, 403);

      const res = await call("GET", "/api/staff/accounts", { token: staff.token });
      assert.equal(res.status, 200);
      assert.ok(res.data.accounts.length >= 2);
      const row = res.data.accounts.find((account) => account._id === savings._id);
      assert.ok(row);
      assert.ok(row.user && row.user.email, "accounts are populated with their owner");

      const filtered = await call("GET", "/api/staff/accounts?status=frozen", { token: staff.token });
      assert.equal(filtered.status, 200);
      assert.ok(filtered.data.accounts.every((account) => account.status === "frozen"));

      const bad = await call("GET", "/api/staff/accounts?status=bogus", { token: staff.token });
      assert.equal(bad.status, 400);
    });
  });
});
