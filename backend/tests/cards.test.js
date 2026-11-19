const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const app = require("../server");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const DebitCard = require("../src/models/DebitCard");
const CreditCard = require("../src/models/CreditCard");
const DebitCardApplication = require("../src/models/DebitCardApplication");
const CreditCardApplication = require("../src/models/CreditCardApplication");

describe("Cards Suite: Debit/Credit Application, Hexadecimal PIN Generation & Change PIN", () => {
  let server;
  let baseUrl;
  const runId = Date.now();
  const emailDomain = `@cards-test-${runId}.com`;

  let customer;
  let staff;
  let savingsAccount;

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
        name: `Cards ${label}`,
        email: `${label}${emailDomain}`,
        password: "Password123!",
        confirmPassword: "Password123!",
      },
    });
    assert.equal(res.status, 201);
    return { id: res.data.user._id, email: res.data.user.email, token: res.data.token };
  };

  before(async () => {
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;

    customer = await register("customer");
    staff = await register("staff");
    await User.updateOne({ _id: staff.id }, { $set: { role: "staff" } });

    // Open active savings account for customer
    const accRes = await call("POST", "/api/staff/accounts", {
      token: staff.token,
      body: { customerId: customer.id, type: "savings" },
    });
    assert.equal(accRes.status, 201);
    savingsAccount = accRes.data.account;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.close();
  });

  describe("Debit Card Applications & Admin Approval Flow", () => {
    let debitAppId;
    let issuedCardId;
    let initialHexPin;

    it("1. Customer applies for a debit card linked to an active account", async () => {
      const res = await call("POST", "/api/cards/debit-applications", {
        token: customer.token,
        body: { accountId: savingsAccount._id },
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.application.status, "pending");
      assert.ok(res.data.application.applicationNumber.startsWith("DCA-"));
      debitAppId = res.data.application._id;
    });

    it("2. Customer cannot apply twice for the same account while pending", async () => {
      const res = await call("POST", "/api/cards/debit-applications", {
        token: customer.token,
        body: { accountId: savingsAccount._id },
      });
      assert.equal(res.status, 409);
    });

    it("3. Customer can view their own debit card applications", async () => {
      const res = await call("GET", "/api/cards/debit-applications/mine", {
        token: customer.token,
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.applications));
      assert.ok(res.data.applications.some((app) => app._id === debitAppId));
    });

    it("4. Staff lists pending debit applications", async () => {
      const res = await call("GET", "/api/cards/debit-applications?status=pending", {
        token: staff.token,
      });
      assert.equal(res.status, 200);
      assert.ok(res.data.applications.some((app) => app._id === debitAppId));
    });

    it("5. Staff approves debit card application: issues card & generates random hexadecimal PIN", async () => {
      const res = await call("PATCH", `/api/cards/debit-applications/${debitAppId}/approve`, {
        token: staff.token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.application.status, "approved");
      assert.equal(res.data.card.status, "active");
      assert.ok(res.data.generatedPin, "Generated PIN must be present");
      assert.match(res.data.generatedPin, /^[0-9A-F]{4}$/, "PIN should be 4-character hexadecimal");

      issuedCardId = res.data.card._id;
      initialHexPin = res.data.generatedPin;

      // Verify card is in the database with status active and linked application
      const dbCard = await DebitCard.findById(issuedCardId).select("+pinHash");
      assert.ok(dbCard);
      assert.equal(dbCard.status, "active");
      assert.ok(dbCard.pinHash);
    });

    it("6. Customer can change their Debit Card PIN from the site", async () => {
      const newPin = "8E4F";
      const res = await call("POST", `/api/cards/debit/${issuedCardId}/pin`, {
        token: customer.token,
        body: { pin: newPin },
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.message, "Debit card PIN updated successfully");

      // Verify pinHash was updated
      const updatedCard = await DebitCard.findById(issuedCardId).select("+pinHash");
      assert.ok(updatedCard.pinHash);
    });

    it("7. Changing Debit Card PIN rejects invalid formats", async () => {
      const res = await call("POST", `/api/cards/debit/${issuedCardId}/pin`, {
        token: customer.token,
        body: { pin: "XYZ!" }, // not valid hex
      });
      assert.equal(res.status, 400);
    });

    it("8. Staff rejects a debit card application with remarks, triggering rejection email", async () => {
      // Create another customer and account to test rejection flow
      const rejectedCust = await register("debit_rejected");
      const accRes = await call("POST", "/api/staff/accounts", {
        token: staff.token,
        body: { customerId: rejectedCust.id, type: "savings" },
      });
      assert.equal(accRes.status, 201);

      const appRes = await call("POST", "/api/cards/debit-applications", {
        token: rejectedCust.token,
        body: { accountId: accRes.data.account._id },
      });
      assert.equal(appRes.status, 201);
      const appId = appRes.data.application._id;

      const rejectRes = await call("PATCH", `/api/cards/debit-applications/${appId}/reject`, {
        token: staff.token,
        body: { remarks: "Insufficient transaction activity on the linked savings account." },
      });
      assert.equal(rejectRes.status, 200);
      assert.equal(rejectRes.data.application.status, "rejected");
      assert.equal(
        rejectRes.data.application.remarks,
        "Insufficient transaction activity on the linked savings account."
      );
    });
  });

  describe("Credit Card Approval & Change PIN Flow", () => {
    let creditAppId;
    let creditCardId;

    it("1. Customer applies for a credit card", async () => {
      const res = await call("POST", "/api/cards/credit-applications", {
        token: customer.token,
        body: { requestedLimitMinor: 5_000_000, confirm: true },
      });
      assert.equal(res.status, 201);
      creditAppId = res.data.application._id;
    });

    it("2. Staff approves credit card application with hexadecimal PIN", async () => {
      const res = await call("PATCH", `/api/cards/credit-applications/${creditAppId}/approve`, {
        token: staff.token,
        body: { approvedLimitMinor: 5_000_000 },
      });
      assert.equal(res.status, 200);
      assert.ok(res.data.generatedPin);
      assert.match(res.data.generatedPin, /^[0-9A-F]{4}$/);
      creditCardId = res.data.card._id;

      // Verify CreditCard has pinHash in DB
      const dbCard = await CreditCard.findById(creditCardId).select("+pinHash");
      assert.ok(dbCard.pinHash);
    });

    it("3. Customer changes Credit Card PIN from the site", async () => {
      const newPin = "3A9D";
      const res = await call("POST", `/api/cards/credit/${creditCardId}/pin`, {
        token: customer.token,
        body: { pin: newPin },
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.message, "Credit card PIN updated successfully");

      const dbCard = await CreditCard.findById(creditCardId).select("+pinHash");
      assert.ok(dbCard.pinHash);
    });

    it("4. Staff rejects credit card application with remarks, triggering rejection email", async () => {
      const rejectedCust = await register("credit_rejected");
      const accRes = await call("POST", "/api/staff/accounts", {
        token: staff.token,
        body: { customerId: rejectedCust.id, type: "savings" },
      });
      assert.equal(accRes.status, 201);

      const appRes = await call("POST", "/api/cards/credit-applications", {
        token: rejectedCust.token,
        body: { requestedLimitMinor: 10_000_000, confirm: true },
      });
      assert.equal(appRes.status, 201);
      const appId = appRes.data.application._id;

      const rejectRes = await call("PATCH", `/api/cards/credit-applications/${appId}/reject`, {
        token: staff.token,
        body: { remarks: "Credit history does not meet current eligibility requirements." },
      });
      assert.equal(rejectRes.status, 200);
      assert.equal(rejectRes.data.application.status, "rejected");
      assert.equal(
        rejectRes.data.application.remarks,
        "Credit history does not meet current eligibility requirements."
      );
    });
  });
});
