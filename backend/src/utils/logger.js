const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[90m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

const getTimestamp = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

const formatPrefix = (level, color) => {
  const time = `${COLORS.dim}[${getTimestamp()}]${COLORS.reset}`;
  const tag = `${color}[${level}]${COLORS.reset}`;
  return `${time} ${tag}`;
};

const logger = {
  info: (msg, ...args) => {
    console.log(`${formatPrefix("INFO", COLORS.cyan)} ${msg}`, ...args);
  },

  success: (msg, ...args) => {
    console.log(`${formatPrefix("SUCCESS", COLORS.green)} ${msg}`, ...args);
  },

  warn: (msg, ...args) => {
    console.warn(`${formatPrefix("WARN", COLORS.yellow)} ${msg}`, ...args);
  },

  error: (msg, ...args) => {
    console.error(`${formatPrefix("ERROR", COLORS.red)} ${msg}`, ...args);
  },

  debug: (msg, ...args) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`${formatPrefix("DEBUG", COLORS.magenta)} ${msg}`, ...args);
    }
  },

  http: (method, url, statusCode, durationMs) => {
    let statusColor = COLORS.green;
    if (statusCode >= 500) {
      statusColor = COLORS.red;
    } else if (statusCode >= 400) {
      statusColor = COLORS.yellow;
    } else if (statusCode >= 300) {
      statusColor = COLORS.cyan;
    }

    const time = `${COLORS.dim}[${getTimestamp()}]${COLORS.reset}`;
    const tag = `${COLORS.magenta}[HTTP]${COLORS.reset}`;
    const methodStr = `${COLORS.bold}${method}${COLORS.reset}`;
    const statusStr = `${statusColor}${statusCode}${COLORS.reset}`;
    const durationStr = `${COLORS.dim}${durationMs.toFixed(2)}ms${COLORS.reset}`;

    console.log(`${time} ${tag} ${methodStr} ${url} ${statusStr} ${durationStr}`);
  },
};

module.exports = logger;

