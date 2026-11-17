const express = require("express");
const {
  listDebitCards,
  requestDebitCard,
  activateDebitCard,
  setDebitCardLimit,
  blockDebitCard,
} = require("../controllers/debitCardController");
const {
  listCreditCards,
  listCardTransactions,
  purchase,
  repay,
  blockCreditCard,
} = require("../controllers/creditCardController");
const {
  createCreditApplication,
  myCreditApplications,
  listCreditApplications,
  approveCreditApplication,
  rejectCreditApplication,
} = require("../controllers/creditApplicationController");
const {
  listBlockedCards,
  setDebitCardStatus,
  setCreditCardStatus,
} = require("../controllers/cardAdminController");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { moneyLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.use(authMiddleware);

const customerOnly = authorizeRoles("customer");
const staffOnly = authorizeRoles("staff", "admin");

// ---- Debit cards (customer) ----
router.get("/debit", customerOnly, listDebitCards);
router.post("/debit", customerOnly, requestDebitCard);
router.post("/debit/:id/activate", customerOnly, activateDebitCard);
router.patch("/debit/:id/limit", customerOnly, setDebitCardLimit);
router.post("/debit/:id/block", customerOnly, blockDebitCard);

// ---- Credit cards (customer) ----
router.get("/credit", customerOnly, listCreditCards);
router.get("/credit/:id/transactions", customerOnly, listCardTransactions);
router.post("/credit/:id/purchase", customerOnly, moneyLimiter, purchase);
router.post("/credit/:id/repay", customerOnly, moneyLimiter, repay);
router.post("/credit/:id/block", customerOnly, blockCreditCard);

// ---- Credit card applications ----
router.post("/credit-applications", customerOnly, createCreditApplication);
router.get("/credit-applications/mine", customerOnly, myCreditApplications);
router.get("/credit-applications", staffOnly, listCreditApplications);
router.patch("/credit-applications/:id/approve", staffOnly, approveCreditApplication);
router.patch("/credit-applications/:id/reject", staffOnly, rejectCreditApplication);

// ---- Staff: blocked cards ----
router.get("/staff/blocked", staffOnly, listBlockedCards);
router.patch("/staff/debit/:id/status", staffOnly, setDebitCardStatus);
router.patch("/staff/credit/:id/status", staffOnly, setCreditCardStatus);

module.exports = router;
