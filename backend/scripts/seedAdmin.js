// Creates the first admin account (or promotes an existing user to admin).
//
// 1. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (and optionally SEED_ADMIN_NAME) in backend/.env
// 2. Run: npm run seed:admin
// 3. Remove the password from .env afterwards.

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");

const run = async () => {
  const name = (process.env.SEED_ADMIN_NAME || "Administrator").trim();
  const email = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "";

  if (!email || !password) {
    console.error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in backend/.env first.");
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error("SEED_ADMIN_PASSWORD must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === "admin") {
      console.log(`${email} is already an admin. Nothing to do.`);
      return;
    }
    existing.role = "admin";
    await existing.save();
    console.log(`Promoted existing user ${email} to admin.`);
    return;
  }

  await User.create({ name, email, password, role: "admin", isEmailVerified: true });
  console.log(`Admin account created: ${email}`);
};

run()
  .catch((error) => {
    console.error(`Seeding failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
