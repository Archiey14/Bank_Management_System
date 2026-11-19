const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const logger = require("../utils/logger");
const { generateToken, verifyToken } = require("../utils/tokenUtils");
const { isStrongPassword, PASSWORD_RULE_MESSAGE } = require("../utils/validators");
const { recordAudit } = require("../utils/audit");
const { STAFF_ROLES } = require("../config/constants");
const { sendPasswordResetEmail, sendLoginOtpEmail } = require("../services/emailService");
const {
  OTP_LOGIN_PURPOSE,
  OTP_TTL_MS,
  MAX_OTP_FAILURES,
  OTP_LOCK_MS,
  generateOtpCode,
  hashOtp,
  verifyOtp,
} = require("../utils/otp");

// Short-lived token handed out after the password step; it can only be
// exchanged at POST /api/auth/otp/verify.
const OTP_LOGIN_WINDOW = "10m";
const OTP_LOCKED_MESSAGE =
  "Too many incorrect codes. Please wait 15 minutes and try again.";

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

// Records the sign-in and hands out the session token. Runs once the emailed
// one-time code has been verified at /api/auth/otp/verify.
const completeLogin = async (user, req, res) => {
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
};

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

// POST /api/auth/login - verifies the password, then emails a one-time code.
// The session token is NOT issued here; the client exchanges the returned
// otpToken at /api/auth/otp/verify once the code arrives.
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

    // Password was right. Issue a one-time code and email it; it becomes the
    // mandatory second step of sign-in.
    const code = generateOtpCode();
    user.loginOtpHash = hashOtp(code);
    user.loginOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    user.loginOtpAttempts = 0;
    user.loginOtpLockUntil = null;

    try {
      await sendLoginOtpEmail({ to: user.email, code });
    } catch (err) {
      logger.error("Login OTP email delivery failure: " + err.message);
      user.loginOtpHash = null;
      user.loginOtpExpires = null;
      await user.save();
      return res.status(500).json({
        message: "Could not send your sign-in code. Please try again later.",
      });
    }

    await user.save();

    const otpToken = generateToken(
      { id: user._id, purpose: OTP_LOGIN_PURPOSE },
      { expiresIn: OTP_LOGIN_WINDOW }
    );
    return res.status(200).json({
      message: "A verification code was sent to your email",
      otpRequired: true,
      otpToken,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/otp/verify - second step of sign-in. Checks the emailed code
// (or rejects it), then issues the real session token.
const verifyLoginOtp = async (req, res, next) => {
  try {
    const { otpToken, code } = req.body ?? {};
    if (!otpToken || !code) {
      return res.status(400).json({ message: "Verification code is required" });
    }

    let decoded;
    try {
      decoded = verifyToken(otpToken);
    } catch {
      return res
        .status(401)
        .json({ message: "Your sign-in session expired. Please sign in again." });
    }
    if (decoded.purpose !== OTP_LOGIN_PURPOSE) {
      return res.status(401).json({ message: "Invalid sign-in session. Please sign in again." });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid sign-in session. Please sign in again." });
    }

    if (user.loginOtpLockUntil && user.loginOtpLockUntil > new Date()) {
      return res.status(429).json({ message: OTP_LOCKED_MESSAGE });
    }
    if (!user.loginOtpHash || !user.loginOtpExpires || user.loginOtpExpires < new Date()) {
      return res.status(401).json({ message: "Your code expired. Please sign in again." });
    }

    if (!verifyOtp(user.loginOtpHash, code)) {
      user.loginOtpAttempts = (user.loginOtpAttempts || 0) + 1;
      if (user.loginOtpAttempts >= MAX_OTP_FAILURES) {
        user.loginOtpAttempts = 0;
        user.loginOtpLockUntil = new Date(Date.now() + OTP_LOCK_MS);
      }
      await user.save();
      return res.status(401).json({ message: "Invalid verification code" });
    }

    // Success: the code is one-shot, so clear it before handing out the token.
    user.loginOtpHash = null;
    user.loginOtpExpires = null;
    user.loginOtpAttempts = 0;
    user.loginOtpLockUntil = null;

    return completeLogin(user, req, res);
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

// PATCH /api/auth/me - the signed-in user can change their profile details (name, phone, avatar).
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body ?? {};

    if (name !== undefined) {
      const trimmedName = typeof name === "string" ? name.trim() : "";
      if (trimmedName.length < 2 || trimmedName.length > 80) {
        return res.status(400).json({ message: "Name must be between 2 and 80 characters" });
      }
      req.user.name = trimmedName;
    }

    if (phone !== undefined) {
      const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
      if (trimmedPhone && !/^[0-9+() -]{7,20}$/.test(trimmedPhone)) {
        return res.status(400).json({ message: "Please provide a valid phone number" });
      }
      req.user.phone = trimmedPhone;
    }

    if (avatar !== undefined) {
      const trimmedAvatar = typeof avatar === "string" ? avatar.trim() : "";
      if (trimmedAvatar.startsWith("data:image/")) {
        // Base64 encoded image upload
        if (trimmedAvatar.length > 2 * 1024 * 1024) {
          return res.status(400).json({ message: "Image is too large. Please choose an image under 2MB." });
        }
      } else if (trimmedAvatar.length > 1000) {
        return res.status(400).json({ message: "Avatar reference is too long" });
      }
      req.user.avatar = trimmedAvatar;
    }

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

// POST /api/auth/google - Authenticate with Google (via Firebase Auth)
const googleLogin = async (req, res, next) => {
  try {
    const { idToken, email, name, photoURL, googleUid } = req.body || {};

    let verifiedEmail = email ? String(email).toLowerCase().trim() : null;
    let verifiedName = name ? String(name).trim() : "";
    let verifiedPicture = typeof photoURL === "string" ? photoURL.trim() : "";
    let verifiedGoogleUid = googleUid ? String(googleUid).trim() : null;

    if (idToken) {
      try {
        const tokenResp = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
        );
        if (tokenResp.ok) {
          const tokenData = await tokenResp.json();
          if (tokenData.email) {
            verifiedEmail = String(tokenData.email).toLowerCase().trim();
          }
          if (tokenData.name) {
            verifiedName = String(tokenData.name).trim();
          }
          if (tokenData.picture) {
            verifiedPicture = String(tokenData.picture).trim();
          }
          if (tokenData.sub) {
            verifiedGoogleUid = String(tokenData.sub).trim();
          }
        }
      } catch (err) {
        logger.warn("Token verification fallback to client payload", err);
      }
    }

    if (!verifiedEmail) {
      return res.status(400).json({ message: "Google authentication failed: Email is required" });
    }

    let user = await User.findOne({ email: verifiedEmail });

    if (user) {
      if (!user.isActive) {
        return res
          .status(403)
          .json({ message: "Your account has been deactivated. Please contact support." });
      }

      if (!user.googleId && verifiedGoogleUid) {
        user.googleId = verifiedGoogleUid;
      }
      if (!user.avatar && verifiedPicture) {
        user.avatar = verifiedPicture;
      }
      user.isEmailVerified = true;
      user.lastLogin = new Date();
      await user.save();
    } else {
      const fallbackName = verifiedName || verifiedEmail.split("@")[0];
      const randomPassword = crypto.randomBytes(32).toString("hex") + "!Aa1";

      user = new User({
        name: fallbackName,
        email: verifiedEmail,
        password: randomPassword,
        role: "customer",
        isEmailVerified: true,
        googleId: verifiedGoogleUid,
        authProvider: "google",
        avatar: verifiedPicture,
        lastLogin: new Date(),
      });
      await user.save();
    }

    if (STAFF_ROLES.includes(user.role)) {
      await recordAudit({
        actor: user,
        action: "auth.google_login",
        targetType: "User",
        targetId: user._id,
        summary: `${user.name} signed in with Google`,
        req,
      });
    }

    const token = generateToken({ id: user._id, role: user.role });
    return res.status(200).json({
      message: "Google sign-in successful",
      user,
      token,
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
  googleLogin,
  verifyLoginOtp,
  getMe,
  updateProfile,
  changePassword,
  logout,
  forgotPassword,
  resetPassword,
};
