const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { generateToken } = require("../utils/tokenUtils");
const { isStrongPassword, PASSWORD_RULE_MESSAGE } = require("../utils/validators");
const { recordAudit } = require("../utils/audit");
const { STAFF_ROLES } = require("../config/constants");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  // Evaluated per request, so tests can set NODE_ENV after the app is loaded.
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication requests, please try again later" },
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

module.exports = {
  authLimiter,
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
};

