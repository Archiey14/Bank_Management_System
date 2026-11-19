const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Fields that must never leave the server. The login-OTP hash, expiry and
// lockout counters do not; there is no on/off flag because the emailed code is
// now the mandatory second step for every sign-in.
const publicTransform = (doc, ret) => {
  delete ret.password;
  delete ret.resetPasswordToken;
  delete ret.resetPasswordExpires;
  delete ret.loginOtpHash;
  delete ret.loginOtpExpires;
  delete ret.loginOtpAttempts;
  delete ret.loginOtpLockUntil;
  delete ret.__v;
  return ret;
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    role: {
      type: String,
      enum: ["customer", "staff", "admin"],
      default: "customer",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    googleId: {
      type: String,
      default: null,
      index: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },

    // Email one-time password for the second step of sign-in. Only the SHA-256
    // hash is stored; the plain code is sent by email and never persisted.
    // See utils/otp.js and controllers/authController.js.
    loginOtpHash: {
      type: String,
      default: null,
    },
    loginOtpExpires: {
      type: Date,
      default: null,
    },
    // Wrong codes are counted; after OTP_MAX_FAILURES the account is locked out
    // for OTP_LOCK_MS before another code can be tried.
    loginOtpAttempts: {
      type: Number,
      default: 0,
    },
    loginOtpLockUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { transform: publicTransform },
    toObject: { transform: publicTransform },
  }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;
  this.password = await bcrypt.hash(this.password, saltRounds);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
