const express = require("express");
const {
  listAccounts,
  openAccount,
  getAccount,
  deposit,
  withdraw,
} = require("../controllers/accountController");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { moneyLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listAccounts);
router.post("/", openAccount);
router.get("/:id", getAccount);
router.post("/:id/deposit", moneyLimiter, deposit);
// Counter withdrawals are a staff action.
router.post("/:id/withdraw", authorizeRoles("staff", "admin"), moneyLimiter, withdraw);

module.exports = router;
