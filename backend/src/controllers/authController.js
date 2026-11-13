const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const logger = require("../utils/logger");
const { generateToken } = require("../utils/tokenUtils");
const { isStrongPassword, PASSWORD_RULE_MESSAGE } = require("../utils/validators");
const { recordAudit } = require("../utils/audit");
const { STAFF_ROLES } = require("../config/constants");
const { sendPasswordResetEmail } = require("../services/emailService");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  // Evaluated per request, so tests can set NODE_ENV after the app is loaded.
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication requests, please try again later" },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  // Evaluated per request, so tests can set NODE_ENV after the app is loaded.
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests. Please try again later." },
});

const register = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long and contain at least one letter, one number, and one special symbol",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: "customer",
    });

    await user.save();

    const token = generateToken({ id: user._id, role: user.role });
    return res.status(201).json({
      message: "Registration successful",
      user,
      token,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email is already registered" });
    }
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is inactive. Please contact support." });
    }

    user.lastLogin = new Date();
    await user.save();

    if (STAFF_ROLES.includes(user.role)) {
      await recordAudit({
        actor: user,
        action: "auth.login",
        targetType: "User",
        targetId: user._id,
        summary: `${user.name} signed in`,
        req,
      });
    }

    const token = generateToken({ id: user._id, role: user.role });
    return res.status(200).json({
      message: "Login successful",
      user,
      token,
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res) => {
  return res.status(200).json({ user: req.user });
};

const logout = async (req, res) => {
  return res.status(200).json({
    message: "Logged out successfully. Please remove your authentication token.",
    tokenStrategy: "stateless-jwt",
    note: "Stateless JWT tokens cannot be invalidated on the server without a token blacklist. The client must discard the token.",
  });
};

// PATCH /api/auth/me - the signed-in user can change their own display name.
const updateProfile = async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ message: "Name must be between 2 and 80 characters" });
    }
    req.user.name = name;
    await req.user.save();
    return res.status(200).json({ message: "Profile updated", user: req.user });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const genericResponse = {
      success: true,
      message: "If an account exists with this email, password reset instructions have been sent.",
    };

    if (!email) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      logger.info("Password reset requested for email");
      return res.status(200).json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const resetUrl = `${clientUrl.replace(/\/$/, "")}/reset-password/${resetToken}`;

    try {
      await sendPasswordResetEmail({ to: user.email, resetUrl });
      logger.info("Reset email successfully submitted to SMTP");
    } catch (err) {
      logger.error("Email delivery failure: " + err.message);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({
        success: false,
        message: "Failed to send password reset email. Please try again later.",
      });
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/auth/password - change own password; needs the current one.
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body ?? {};
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: "New password must be different from the current one" });
    }

    const matches = await req.user.comparePassword(currentPassword);
    if (!matches) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    req.user.password = newPassword;
    await req.user.save();
    return res.status(200).json({ message: "Password changed" });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.status(400).json({ message: "Password and password confirmation are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long and contain at least one letter, one number, and one special symbol",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      logger.warn("Invalid or expired reset token attempt");
      return res.status(400).json({ message: "Password reset token is invalid or has expired" });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    logger.success("Password successfully reset");

    return res.status(200).json({
      success: true,
      message: "Password has been successfully reset. You can now log in with your new password.",
      statelessJwtNote: "This system uses stateless JWT authentication. Existing JWT tokens cannot be invalidated without a token revocation blacklist. Clients should discard existing tokens upon password reset.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authLimiter,
  passwordResetLimiter,
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
  forgotPassword,
  resetPassword,
};

