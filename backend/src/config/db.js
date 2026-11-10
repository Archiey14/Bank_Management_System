const dns = require("dns");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

let listenersRegistered = false;

const registerConnectionListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB connection interrupted");
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected");
  });
};

const connectDB = async () => {
  registerConnectionListeners();
  logger.info("Connecting to MongoDB...");

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.success("MongoDB connected successfully");
    logger.debug(`Database: ${mongoose.connection.name || "default"} | Host: ${mongoose.connection.host || "cluster"}`);
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
