const express = require("express");
const {
  listAccounts,
  openAccount,
  getAccount,
  updateAccount,
  deposit,
  withdraw,
  setAccountStatus,
} = require("../controllers/accountController");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { moneyLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listAccounts);
router.post("/", openAccount);
router.get("/:id", getAccount);
router.patch("/:id", updateAccount);
router.post("/:id/deposit", moneyLimiter, deposit);
// Self-service / ATM withdrawal for customer (account must belong to user, balance verified)
router.post("/:id/atm-withdraw", moneyLimiter, withdraw);
// Counter withdrawals are a staff action.
router.post("/:id/withdraw", authorizeRoles("staff", "admin"), moneyLimiter, withdraw);
router.patch("/:id/status", authorizeRoles("staff", "admin"), setAccountStatus);

module.exports = router;
