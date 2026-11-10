const logger = require("../utils/logger");

const SENSITIVE_QUERY_PATTERN = /^(password|token|secret|key|otp|auth|cvv|pin|account|access_token|refresh_token|confirmpassword)$/i;

const sanitizeUrl = (rawUrl) => {
  if (!rawUrl || !rawUrl.includes("?")) return rawUrl || "/";
  const [path, query] = rawUrl.split("?");
  const params = new URLSearchParams(query);
  for (const [key] of params.entries()) {
    if (SENSITIVE_QUERY_PATTERN.test(key)) {
      params.set(key, "[REDACTED]");
    }
  }
  return `${path}?${decodeURIComponent(params.toString())}`;
};

const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();
  let logged = false;

  const logResponse = () => {
    if (logged) return;
    logged = true;

    const diff = process.hrtime.bigint() - start;
    const durationMs = Number(diff) / 1e6;
    const sanitizedUrl = sanitizeUrl(req.originalUrl || req.url);

    logger.http(req.method, sanitizedUrl, res.statusCode, durationMs);
  };

  res.on("finish", logResponse);
  res.on("close", logResponse);

  next();
};

module.exports = requestLogger;

