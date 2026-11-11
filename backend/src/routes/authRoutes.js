const express = require("express");
const {
  authLimiter,
  passwordResetLimiter,
  register,
  login,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", authMiddleware, getMe);
router.post("/logout", logout);
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/reset-password/:token", passwordResetLimiter, resetPassword);

router.get("/admin-only", authMiddleware, authorizeRoles("admin"), (req, res) => {
  res.status(200).json({ message: "Admin access granted" });
});

router.get("/staff-only", authMiddleware, authorizeRoles("staff", "admin"), (req, res) => {
  res.status(200).json({ message: "Staff access granted" });
});

module.exports = router;

