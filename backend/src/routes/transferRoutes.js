const express = require("express");
const { createTransfer } = require("../controllers/transactionController");
const authMiddleware = require("../middleware/authMiddleware");
const { moneyLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.use(authMiddleware);

router.post("/", moneyLimiter, createTransfer);

module.exports = router;
