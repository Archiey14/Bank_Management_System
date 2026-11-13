require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const validateEnv = require("./src/config/validateEnv");
const connectDB = require("./src/config/db");
const logger = require("./src/utils/logger");
const requestLogger = require("./src/middleware/requestLogger");
const authRoutes = require("./src/routes/authRoutes");
const healthRoutes = require("./src/routes/healthRoutes");
const accountRoutes = require("./src/routes/accountRoutes");
const transactionRoutes = require("./src/routes/transactionRoutes");
const transferRoutes = require("./src/routes/transferRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const errorHandler = require("./src/middleware/errorHandler");

validateEnv();

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed for this origin"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(requestLogger);

app.get("/", (req, res) => {
  res.send("Bank Management API is running");
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
let server;
let isShuttingDown = false;

const printStartupBanner = (port) => {
  const env = process.env.NODE_ENV || "development";
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("        BANK MANAGEMENT SYSTEM      ");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  logger.info(`Environment : ${env}`);
  logger.success("Database    : Connected");
  logger.success("Server      : Running");
  logger.info(`Port        : ${port}`);
  logger.info(`API         : http://localhost:${port}/api`);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
};

const gracefulShutdown = async (signal, exitCode = 0) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`Shutdown signal received: ${signal}`);

  if (server) {
    logger.info("Closing HTTP server...");
    await new Promise((resolve) => server.close(resolve));
  }

  logger.info("Closing MongoDB connection...");
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
    }
  } catch (err) {
    logger.error(`Error closing MongoDB: ${err.message}`);
  }

  logger.success("Application shut down successfully");
  if (process.env.NODE_ENV !== "test") {
    process.exit(exitCode);
  }
};

if (require.main === module) {
  connectDB()
    .then(() => {
      server = app.listen(PORT, () => {
        printStartupBanner(PORT);
      });

      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          logger.error(`Port ${PORT} is already in use. Please stop the process or select a different port.`);
        } else {
          logger.error(`Server startup error: ${err.message}`);
        }
        process.exit(1);
      });

      process.on("SIGINT", () => gracefulShutdown("SIGINT"));
      process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

      process.on("uncaughtException", (err) => {
        logger.error(`Uncaught Exception: ${err.message}`);
        gracefulShutdown("uncaughtException", 1);
      });

      process.on("unhandledRejection", (reason) => {
        logger.error(`Unhandled Rejection: ${reason instanceof Error ? reason.message : reason}`);
        gracefulShutdown("unhandledRejection", 1);
      });
    })
    .catch((err) => {
      logger.error(`Failed to start application: ${err.message}`);
      process.exit(1);
    });
}

app.gracefulShutdown = gracefulShutdown;
app.printStartupBanner = printStartupBanner;

module.exports = app;
