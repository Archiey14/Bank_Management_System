const express = require("express");
const {
  listUsers,
  createUser,
  updateUser,
  listAuditLogs,
  getSystemReports,
} = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authMiddleware, authorizeRoles("admin"));

router.get("/users", listUsers);
router.post("/users", createUser);
router.patch("/users/:id", updateUser);
router.get("/audit-logs", listAuditLogs);
router.get("/reports", getSystemReports);

module.exports = router;

