const express = require("express");
const {
  getOverview,
  listAllAccounts,
  openAccountForCustomer,
  listFlaggedTransfers,
  reviewFlaggedTransfer,
} = require("../controllers/staffController");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authMiddleware, authorizeRoles("staff", "admin"));

router.get("/overview", getOverview);
router.get("/accounts", listAllAccounts);
router.post("/accounts", openAccountForCustomer);
router.get("/flagged-transfers", listFlaggedTransfers);
router.patch("/flagged-transfers/:id/review", reviewFlaggedTransfer);

module.exports = router;
