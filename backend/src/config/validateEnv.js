const REQUIRED_ENV_VARS = ["PORT", "MONGODB_URI", "JWT_SECRET"];

const validateEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`Fatal: Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
};

module.exports = validateEnv;

