const { TIMEZONE } = require("../config/constants");

const pad = (n) => String(n).padStart(2, "0");

// Year/month/day of an instant as seen in the given time zone.
const partsInTimezone = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  return { year: get("year"), month: get("month"), day: get("day") };
};

// ["2026-06", ..., "2026-11"] - oldest first, ending with the current month.
const lastMonthKeys = (count, now = new Date(), timeZone = TIMEZONE) => {
  const { year, month } = partsInTimezone(now, timeZone);
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  return keys;
};

// ["2026-11-06", ..., "2026-11-12"] - oldest first, ending with today.
const lastDayKeys = (count, now = new Date(), timeZone = TIMEZONE) => {
  const { year, month, day } = partsInTimezone(now, timeZone);
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - 1, day - i));
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
};

// A UTC instant safely before the start of the given "YYYY-MM" month in any
// time zone (one day of margin), used to bound database queries.
const monthKeyToQueryStart = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1) - 24 * 60 * 60 * 1000);
};

module.exports = { lastMonthKeys, lastDayKeys, monthKeyToQueryStart };
