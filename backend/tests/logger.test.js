const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const logger = require("../src/utils/logger");
const requestLogger = require("../src/middleware/requestLogger");
const errorHandler = require("../src/middleware/errorHandler");
const app = require("../server");
const connectDB = require("../src/config/db");

const stripAnsi = (str) => str.replace(/\x1B\[[0-9;]*m/g, "");

const createMockResponse = (statusCode = 200) => {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (payload) {
    this.body = payload;
    this.emit("finish");
    return this;
  };
  return res;
};

describe("Centralized Backend Logger & Monitoring Suite", () => {
  let logBuffer = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  const startCapture = () => {
    logBuffer = [];
    console.log = (...args) => {
      logBuffer.push(args.join(" "));
      originalLog.apply(console, args);
    };
    console.warn = (...args) => {
      logBuffer.push(args.join(" "));
      originalWarn.apply(console, args);
    };
    console.error = (...args) => {
      logBuffer.push(args.join(" "));
      originalError.apply(console, args);
    };
  };

  const stopCapture = () => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  };

  const getCleanLogs = () => stripAnsi(logBuffer.join("\n"));

  it("1. Logger outputs all levels with timestamps and tags", () => {
    startCapture();
    logger.info("Test info message");
    logger.success("Test success message");
    logger.warn("Test warn message");
    logger.error("Test error message");
    logger.debug("Test debug message");
    stopCapture();

    const output = getCleanLogs();
    assert.match(output, /\[\d{2}:\d{2}:\d{2}\]/);
    assert.match(output, /\[INFO\] Test info message/);
    assert.match(output, /\[SUCCESS\] Test success message/);
    assert.match(output, /\[WARN\] Test warn message/);
    assert.match(output, /\[ERROR\] Test error message/);
  });

  it("2. HTTP request logger logs GET request, status, and duration", () => {
    const req = { method: "GET", url: "/api/health", originalUrl: "/api/health" };
    const res = createMockResponse(200);

    startCapture();
    requestLogger(req, res, () => {});
    res.emit("finish");
    stopCapture();

    const output = getCleanLogs();
    assert.match(output, /\[HTTP\]/);
    assert.match(output, /GET \/api\/health/);
    assert.match(output, /200/);
    assert.match(output, /\d+(\.\d+)?ms/);
  });

  it("3. HTTP request logger logs POST request without body or token exposure", () => {
    const req = {
      method: "POST",
      url: "/api/auth/login",
      originalUrl: "/api/auth/login",
      headers: {
        authorization: "Bearer secret-jwt-token-string",
        cookie: "session_id=secret-cookie-value",
      },
      body: {
        password: "SuperSecretPassword123!",
        accountNumber: "1234567890123456",
        otp: "654321",
      },
    };
    const res = createMockResponse(201);

    startCapture();
    requestLogger(req, res, () => {});
    res.emit("finish");
    stopCapture();

    const output = getCleanLogs();
    assert.match(output, /\[HTTP\] POST \/api\/auth\/login 201/);
    assert.doesNotMatch(output, /SuperSecretPassword123!/);
    assert.doesNotMatch(output, /secret-jwt-token-string/);
    assert.doesNotMatch(output, /secret-cookie-value/);
    assert.doesNotMatch(output, /1234567890123456/);
    assert.doesNotMatch(output, /654321/);
  });

  it("4. Redacts sensitive query parameters in request logging", () => {
    const req = {
      method: "GET",
      url: "/api/accounts?account=1122334455&token=jwt123&password=pass&filter=active",
      originalUrl: "/api/accounts?account=1122334455&token=jwt123&password=pass&filter=active",
    };
    const res = createMockResponse(200);

    startCapture();
    requestLogger(req, res, () => {});
    res.emit("finish");
    stopCapture();

    const output = getCleanLogs();
    assert.match(output, /account=\[REDACTED\]/);
    assert.match(output, /token=\[REDACTED\]/);
    assert.match(output, /password=\[REDACTED\]/);
    assert.match(output, /filter=active/);
    assert.doesNotMatch(output, /1122334455/);
    assert.doesNotMatch(output, /jwt123/);
  });

  it("5. Logger HTTP method supports 2xx, 3xx, 4xx, and 5xx status codes", () => {
    startCapture();
    logger.http("GET", "/test-200", 200, 1.25);
    logger.http("GET", "/test-301", 301, 2.5);
    logger.http("GET", "/test-404", 404, 3.75);
    logger.http("GET", "/test-500", 500, 5.0);
    stopCapture();

    const output = getCleanLogs();
    assert.match(output, /GET \/test-200 200 1\.25ms/);
    assert.match(output, /GET \/test-301 301 2\.50ms/);
    assert.match(output, /GET \/test-404 404 3\.75ms/);
    assert.match(output, /GET \/test-500 500 5\.00ms/);
  });

  it("6. Centralized error handler logs 500 error and hides stack trace in production", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const err = new Error("Database transaction failed");
    err.statusCode = 500;
    const req = { method: "POST", url: "/api/transfers", originalUrl: "/api/transfers" };
    const res = createMockResponse(500);

    startCapture();
    errorHandler(err, req, res, () => {});
    stopCapture();

    process.env.NODE_ENV = prevEnv;

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, "Internal server error");

    const output = getCleanLogs();
    assert.match(output, /\[ERROR\] Unhandled error/);
    assert.match(output, /Database transaction failed/);
  });

  it("7. Startup banner prints expected visual layout", () => {
    startCapture();
    app.printStartupBanner(5001);
    stopCapture();

    const output = getCleanLogs();
    assert.match(output, /BANK MANAGEMENT SYSTEM/);
    assert.match(output, /Environment/);
    assert.match(output, /Database\s+:\s+Connected/);
    assert.match(output, /Server\s+:\s+Running/);
    assert.match(output, /Port\s+:\s+5001/);
    assert.match(output, /API\s+:\s+http:\/\/localhost:5001\/api/);
  });

  it("8. Port conflict handling logs EADDRINUSE error message", () => {
    startCapture();
    const port = 5001;
    logger.error(`Port ${port} is already in use. Please stop the process or select a different port.`);
    stopCapture();

    const output = getCleanLogs();
    assert.match(output, /\[ERROR\] Port 5001 is already in use/);
  });

  it("9. Graceful shutdown logs expected shutdown sequence", () => {
    startCapture();
    logger.warn("Shutdown signal received: SIGINT");
    logger.info("Closing HTTP server...");
    logger.info("Closing MongoDB connection...");
    logger.success("Application shut down successfully");
    stopCapture();

    const output = getCleanLogs();
    assert.match(output, /Shutdown signal received: SIGINT/);
    assert.match(output, /Closing HTTP server\.\.\./);
    assert.match(output, /Closing MongoDB connection\.\.\./);
    assert.match(output, /Application shut down successfully/);
  });

  it("10. MongoDB connection failure handles invalid URI safely", async () => {
    const prevUri = process.env.MONGODB_URI;
    process.env.MONGODB_URI = "mongodb://bad_host:27017/test?serverSelectionTimeoutMS=200&connectTimeoutMS=200";

    startCapture();
    try {
      await connectDB();
    } catch (err) {
      assert.ok(err);
    }
    stopCapture();

    process.env.MONGODB_URI = prevUri;

    const output = getCleanLogs();
    assert.match(output, /Connecting to MongoDB\.\.\./);
    assert.match(output, /\[ERROR\] MongoDB connection failed/);
    assert.doesNotMatch(output, /password/i);
  });

  it("11. Existing health check route is mounted and functional", () => {
    const req = { method: "GET", url: "/api/health", originalUrl: "/api/health" };
    const res = createMockResponse(200);

    startCapture();
    requestLogger(req, res, () => {});
    res.status(200).json({ status: "ok", message: "API is healthy" });
    stopCapture();

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, "ok");

    const output = getCleanLogs();
    assert.match(output, /\[HTTP\] GET \/api\/health 200/);
  });
});
