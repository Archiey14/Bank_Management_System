const express = require("express");
const {
  bookFixedDeposit,
  listFixedDeposits,
  settleFixedDeposit,
} = require("../controllers/fixedDepositController");
const authMiddleware = require("../middleware/authMiddleware");
const { moneyLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listFixedDeposits);
router.post("/", moneyLimiter, bookFixedDeposit);
router.post("/:id/settle", moneyLimiter, settleFixedDeposit);

module.exports = router;
