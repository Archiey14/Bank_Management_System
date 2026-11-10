const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  if (statusCode >= 500) {
    logger.error(`Unhandled error [${err.name || "Error"}]: ${err.message} on ${req.method} ${req.originalUrl || req.url}`);
    if (process.env.NODE_ENV !== "production" && err.stack) {
      logger.debug(err.stack);
    }
  } else {
    logger.warn(`Client error [${err.name || "ClientError"}]: ${err.message} (${statusCode}) on ${req.method} ${req.originalUrl || req.url}`);
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((item) => item.message);
    return res.status(400).json({ message: messages.join(", ") });
  }

  if (err.code === 11000) {
    return res.status(409).json({ message: "Duplicate value entered" });
  }

  const message = statusCode === 500 ? "Internal server error" : err.message;
  res.status(statusCode).json({ message });
};

module.exports = errorHandler;
