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

// These tests move money through real database transactions, so MONGODB_URI must
// point at a replica set (MongoDB Atlas is one). Use a dedicated test database.

describe("Banking: accounts, deposits, transfers and dashboard", () => {
  let server;
  let baseUrl;
  const runId = Date.now();
  const emailDomain = `@bank-test-${runId}.com`;

  let customerA;
  let customerB;
  let staff;
  let a1;
  let a2;
  let a3;
  let b1;

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

  const registerCustomer = async (label) => {
    const res = await call("POST", "/api/auth/register", {
      body: {
        name: `Bank Test ${label}`,
        email: `${label}${emailDomain}`,
        password: "Password123!",
        confirmPassword: "Password123!",
      },
    });
    assert.equal(res.status, 201);
    return { id: res.data.user._id, token: res.data.token };
  };

  const openAccount = async (who, type) => {
    const res = await call("POST", "/api/accounts", { token: who.token, body: { type } });
    assert.equal(res.status, 201);
    return res.data.account;
  };

  const balanceOf = async (who, account) => {
    const res = await call("GET", `/api/accounts/${account._id}`, { token: who.token });
    assert.equal(res.status, 200);
    return res.data.account.balance;
  };

  const transfer = (who, from, toAccountNumber, amountMinor, headers) =>
    call("POST", "/api/transfers", {
      token: who.token,
      headers,
      body: { fromAccountId: from._id, toAccountNumber, amountMinor },
    });

  before(async () => {
    process.env.NODE_ENV = "test";
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    customerA = await registerCustomer("a");
    customerB = await registerCustomer("b");

    const staffUser = new User({
      name: "Bank Test Staff",
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
  });

  after(async () => {
    const users = await User.find({ email: new RegExp(emailDomain) }).select("_id");
    const ids = users.map((user) => user._id);
    await Transaction.deleteMany({ user: { $in: ids } });
    await Account.deleteMany({ user: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  });

  it("1. Banking routes require authentication", async () => {
    assert.equal((await call("GET", "/api/accounts")).status, 401);
    assert.equal((await call("POST", "/api/transfers", { body: {} })).status, 401);
    assert.equal((await call("GET", "/api/transactions")).status, 401);
    assert.equal((await call("GET", "/api/dashboard/summary")).status, 401);
  });

  it("2. A new customer has no accounts and an empty dashboard", async () => {
    const accounts = await call("GET", "/api/accounts", { token: customerA.token });
    assert.equal(accounts.status, 200);
    assert.deepEqual(accounts.data.accounts, []);

    const summary = await call("GET", "/api/dashboard/summary", { token: customerA.token });
    assert.equal(summary.status, 200);
    assert.equal(typeof summary.data.currency, "string");
    assert.deepEqual(summary.data.totals, {
      balanceMinor: 0,
      moneyInMinor: 0,
      moneyOutMinor: 0,
      pendingCount: 0,
    });
    assert.deepEqual(summary.data.accounts, []);
    assert.equal(summary.data.cashflow.length, 6);
    assert.ok(summary.data.cashflow.every((m) => m.inMinor === 0 && m.outMinor === 0));
    assert.equal(summary.data.balanceTrend.length, 7);
    assert.ok(summary.data.balanceTrend.every((d) => d.balanceMinor === 0));
    assert.deepEqual(summary.data.recentTransactions, []);
  });

  it("3. A customer can open accounts", async () => {
    a1 = await openAccount(customerA, "savings");
    a2 = await openAccount(customerA, "current");
    b1 = await openAccount(customerB, "savings");

    assert.match(a1.accountNumber, /^\d{12}$/);
    assert.equal(a1.balance, 0);
    assert.equal(a1.status, "active");
    assert.equal(a1.user, customerA.id);
    assert.notEqual(a1.accountNumber, a2.accountNumber);
  });

  it("4. Invalid account types are rejected", async () => {
    const res = await call("POST", "/api/accounts", {
      token: customerA.token,
      body: { type: "platinum" },
    });
    assert.equal(res.status, 400);
  });

  it("5. A customer can deposit into their own account", async () => {
    const res = await call("POST", `/api/accounts/${a1._id}/deposit`, {
      token: customerA.token,
      body: { amountMinor: 100000, description: "Salary" },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.account.balance, 100000);
    assert.equal(res.data.transaction.type, "deposit");
    assert.equal(res.data.transaction.amount, 100000);
    assert.equal(res.data.transaction.balanceAfter, 100000);
    assert.equal(res.data.transaction.description, "Salary");
  });

  it("6. Invalid amounts are rejected", async () => {
    const bad = [0, -5, 10.5, "100", null, 1_000_000_001];
    for (const amountMinor of bad) {
      const res = await call("POST", `/api/accounts/${a1._id}/deposit`, {
        token: customerA.token,
        body: { amountMinor },
      });
      assert.equal(res.status, 400, `expected ${String(amountMinor)} to be rejected`);
    }
    const missing = await call("POST", `/api/accounts/${a1._id}/deposit`, {
      token: customerA.token,
      body: {},
    });
    assert.equal(missing.status, 400);
    assert.equal(await balanceOf(customerA, a1), 100000);
  });

  it("7. A customer cannot reach another customer's account", async () => {
    const deposit = await call("POST", `/api/accounts/${a1._id}/deposit`, {
      token: customerB.token,
      body: { amountMinor: 1000 },
    });
    assert.equal(deposit.status, 404);

    const read = await call("GET", `/api/accounts/${a1._id}`, { token: customerB.token });
    assert.equal(read.status, 404);

    const badId = await call("GET", "/api/accounts/not-an-id", { token: customerA.token });
    assert.equal(badId.status, 404);
  });

  it("8. Withdrawals are staff-only, and staff can deposit for customers", async () => {
    const customerWithdraw = await call("POST", `/api/accounts/${a1._id}/withdraw`, {
      token: customerA.token,
      body: { amountMinor: 1000 },
    });
    assert.equal(customerWithdraw.status, 403);

    const staffDeposit = await call("POST", `/api/accounts/${a1._id}/deposit`, {
      token: staff.token,
      body: { amountMinor: 50000 },
    });
    assert.equal(staffDeposit.status, 201);
    assert.equal(staffDeposit.data.account.balance, 150000);
    assert.equal(staffDeposit.data.transaction.user, customerA.id);
    assert.equal(staffDeposit.data.transaction.initiatedBy, staff.id);

    const staffWithdraw = await call("POST", `/api/accounts/${a1._id}/withdraw`, {
      token: staff.token,
      body: { amountMinor: 20000 },
    });
    assert.equal(staffWithdraw.status, 201);
    assert.equal(staffWithdraw.data.account.balance, 130000);
    assert.equal(staffWithdraw.data.transaction.amount, -20000);

    const overdraw = await call("POST", `/api/accounts/${a1._id}/withdraw`, {
      token: staff.token,
      body: { amountMinor: 999_999_999 },
    });
    assert.equal(overdraw.status, 422);
    assert.match(overdraw.data.message, /insufficient funds/i);
    assert.equal(await balanceOf(customerA, a1), 130000);
  });

  it("9. A customer can transfer between their own accounts", async () => {
    const res = await transfer(customerA, a1, a2.accountNumber, 30000);
    assert.equal(res.status, 201);
    assert.equal(res.data.account.balance, 100000);
    assert.equal(res.data.transaction.type, "transfer_out");
    assert.equal(res.data.transaction.amount, -30000);
    assert.equal(res.data.transaction.isInternal, true);
    assert.equal(await balanceOf(customerA, a2), 30000);

    const credit = await call("GET", `/api/transactions?accountId=${a2._id}`, {
      token: customerA.token,
    });
    assert.equal(credit.status, 200);
    assert.equal(credit.data.transactions.length, 1);
    assert.equal(credit.data.transactions[0].type, "transfer_in");
    assert.equal(credit.data.transactions[0].transferId, res.data.transferId);
  });

  it("10. A customer can transfer to another customer's account number", async () => {
    const res = await transfer(customerA, a1, b1.accountNumber, 25000);
    assert.equal(res.status, 201);
    assert.equal(res.data.account.balance, 75000);
    assert.equal(res.data.transaction.isInternal, false);
    assert.equal(await balanceOf(customerB, b1), 25000);

    const incoming = await call("GET", "/api/transactions?type=transfer_in", {
      token: customerB.token,
    });
    assert.equal(incoming.status, 200);
    assert.equal(incoming.data.transactions.length, 1);
    assert.equal(incoming.data.transactions[0].amount, 25000);
    assert.equal(incoming.data.transactions[0].counterpartyAccountNumber, a1.accountNumber);
    assert.equal(incoming.data.transactions[0].isInternal, false);
  });

  it("11. A transfer with insufficient funds is rejected and nothing changes", async () => {
    const res = await transfer(customerA, a2, b1.accountNumber, 30001);
    assert.equal(res.status, 422);
    assert.match(res.data.message, /insufficient funds/i);
    assert.equal(await balanceOf(customerA, a2), 30000);
    assert.equal(await balanceOf(customerB, b1), 25000);
  });

  it("12. Transfer requests are validated", async () => {
    const same = await transfer(customerA, a1, a1.accountNumber, 100);
    assert.equal(same.status, 400);

    const unknown = await transfer(customerA, a1, "999999999999", 100);
    assert.equal(unknown.status, 404);

    const badNumber = await transfer(customerA, a1, "123", 100);
    assert.equal(badNumber.status, 400);

    const foreignSource = await transfer(customerB, a1, b1.accountNumber, 100);
    assert.equal(foreignSource.status, 404);

    const noSource = await call("POST", "/api/transfers", {
      token: customerA.token,
      body: { toAccountNumber: b1.accountNumber, amountMinor: 100 },
    });
    assert.equal(noSource.status, 400);

    assert.equal(await balanceOf(customerA, a1), 75000);
  });

  it("13. A repeated request with the same Idempotency-Key moves money only once", async () => {
    const key = `idem-${runId}-1`;
    const first = await transfer(customerA, a1, b1.accountNumber, 5000, {
      "Idempotency-Key": key,
    });
    assert.equal(first.status, 201);
    assert.equal(first.data.account.balance, 70000);

    const second = await transfer(customerA, a1, b1.accountNumber, 5000, {
      "Idempotency-Key": key,
    });
    assert.equal(second.status, 200);
    assert.equal(second.data.replayed, true);
    assert.equal(second.data.transferId, first.data.transferId);
    assert.equal(await balanceOf(customerA, a1), 70000);

    const different = await transfer(customerA, a1, b1.accountNumber, 6000, {
      "Idempotency-Key": key,
    });
    assert.equal(different.status, 409);

    const malformed = await transfer(customerA, a1, b1.accountNumber, 5000, {
      "Idempotency-Key": "short",
    });
    assert.equal(malformed.status, 400);
    assert.equal(await balanceOf(customerA, a1), 70000);
  });

  it("14. Concurrent transfers can never overdraw an account", async () => {
    a3 = await openAccount(customerA, "current");
    const fund = await call("POST", `/api/accounts/${a3._id}/deposit`, {
      token: customerA.token,
      body: { amountMinor: 100000 },
    });
    assert.equal(fund.status, 201);

    // 5 x 30,000 against a balance of 100,000: exactly 3 can succeed.
    const results = await Promise.all(
      Array.from({ length: 5 }, () => transfer(customerA, a3, b1.accountNumber, 30000))
    );
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 201, 201, 422, 422]);
    assert.equal(await balanceOf(customerA, a3), 10000);
    assert.equal(await balanceOf(customerB, b1), 25000 + 5000 + 90000);
  });

  it("15. Customers can have at most 5 open accounts", async () => {
    await openAccount(customerA, "savings");
    await openAccount(customerA, "fixed_deposit");
    const sixth = await call("POST", "/api/accounts", {
      token: customerA.token,
      body: { type: "savings" },
    });
    assert.equal(sixth.status, 400);
    assert.match(sixth.data.message, /at most 5/i);
  });

  it("16. The transaction list paginates, filters and stays private", async () => {
    const page1 = await call("GET", "/api/transactions?limit=2&page=1", {
      token: customerA.token,
    });
    assert.equal(page1.status, 200);
    assert.equal(page1.data.transactions.length, 2);
    assert.ok(page1.data.total >= 5);
    assert.equal(page1.data.totalPages, Math.ceil(page1.data.total / 2));
    assert.ok(page1.data.transactions.every((t) => t.user === customerA.id));

    const page2 = await call("GET", "/api/transactions?limit=2&page=2", {
      token: customerA.token,
    });
    assert.notEqual(page2.data.transactions[0]._id, page1.data.transactions[0]._id);

    const deposits = await call("GET", "/api/transactions?type=deposit", {
      token: customerA.token,
    });
    assert.ok(deposits.data.transactions.length >= 3);
    assert.ok(deposits.data.transactions.every((t) => t.type === "deposit"));

    const byAccount = await call("GET", `/api/transactions?accountId=${a2._id}`, {
      token: customerA.token,
    });
    assert.ok(byAccount.data.transactions.every((t) => t.account === a2._id));

    assert.equal(
      (await call("GET", "/api/transactions?type=nonsense", { token: customerA.token })).status,
      400
    );
    assert.equal(
      (await call("GET", "/api/transactions?accountId=abc", { token: customerA.token })).status,
      400
    );
    assert.equal(
      (await call("GET", "/api/transactions?type=deposit&type=withdrawal", { token: customerA.token }))
        .status,
      400
    );

    const bRows = await call("GET", "/api/transactions?limit=100", { token: customerB.token });
    assert.ok(bRows.data.transactions.length > 0);
    assert.ok(bRows.data.transactions.every((t) => t.user === customerB.id));
  });

  it("17. The dashboard summary agrees with the ledger", async () => {
    const accountsRes = await call("GET", "/api/accounts", { token: customerA.token });
    const totalBalance = accountsRes.data.accounts.reduce((sum, a) => sum + a.balance, 0);

    const all = await call("GET", "/api/transactions?limit=100", { token: customerA.token });
    const rows = all.data.transactions;
    assert.ok(rows.some((t) => t.isInternal), "expected an internal transfer in the ledger");
    const external = rows.filter((t) => !t.isInternal && t.status === "completed");
    const expectedIn = external.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expectedOut = external.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);

    const summary = await call("GET", "/api/dashboard/summary", { token: customerA.token });
    assert.equal(summary.status, 200);
    assert.equal(summary.data.totals.balanceMinor, totalBalance);
    // Everything in this test was created just now, so it all falls in this month.
    assert.equal(summary.data.totals.moneyInMinor, expectedIn);
    assert.equal(summary.data.totals.moneyOutMinor, expectedOut);
    assert.equal(summary.data.totals.pendingCount, 0);

    assert.equal(summary.data.accounts.length, accountsRes.data.accounts.length);
    assert.equal(summary.data.cashflow.length, 6);
    assert.equal(summary.data.balanceTrend.length, 7);
    assert.equal(summary.data.balanceTrend[6].balanceMinor, totalBalance);
    const dates = summary.data.balanceTrend.map((d) => d.date);
    assert.deepEqual(dates, [...dates].sort());

    const recent = summary.data.recentTransactions;
    assert.equal(recent.length, 6);
    const times = recent.map((t) => new Date(t.createdAt).getTime());
    assert.deepEqual(times, [...times].sort((x, y) => y - x));
  });
});
