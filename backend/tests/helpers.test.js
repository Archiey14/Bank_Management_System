// Pure unit tests: no database or server needed.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseAmountMinor } = require("../src/utils/money");
const { lastMonthKeys, lastDayKeys } = require("../src/utils/dateRanges");
const { MAX_AMOUNT_MINOR } = require("../src/config/constants");

describe("parseAmountMinor", () => {
  it("accepts whole positive numbers up to the maximum", () => {
    assert.equal(parseAmountMinor(1), 1);
    assert.equal(parseAmountMinor(25050), 25050);
    assert.equal(parseAmountMinor(MAX_AMOUNT_MINOR), MAX_AMOUNT_MINOR);
  });

  it("rejects zero, negatives, decimals, strings and non-numbers", () => {
    const bad = [0, -1, 10.5, "100", null, undefined, NaN, Infinity, MAX_AMOUNT_MINOR + 1];
    for (const value of bad) {
      assert.throws(
        () => parseAmountMinor(value),
        (error) => error.statusCode === 400,
        `expected ${String(value)} to be rejected`
      );
    }
  });
});

describe("lastMonthKeys", () => {
  it("returns the last N months, oldest first, ending with the current month", () => {
    const keys = lastMonthKeys(6, new Date("2026-11-12T10:00:00Z"), "Asia/Kolkata");
    assert.deepEqual(keys, ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
  });

  it("crosses a year boundary correctly", () => {
    const keys = lastMonthKeys(6, new Date("2026-01-15T10:00:00Z"), "UTC");
    assert.deepEqual(keys, ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]);
  });

  it("uses the time zone to decide which month it is", () => {
    const instant = new Date("2026-11-30T20:00:00Z"); // already 1 Dec in India
    assert.deepEqual(lastMonthKeys(1, instant, "Asia/Kolkata"), ["2026-12"]);
    assert.deepEqual(lastMonthKeys(1, instant, "UTC"), ["2026-11"]);
  });
});

describe("lastDayKeys", () => {
  it("returns the last N days, oldest first, ending with today", () => {
    const keys = lastDayKeys(7, new Date("2026-03-02T05:00:00Z"), "UTC");
    assert.deepEqual(keys, [
      "2026-02-24",
      "2026-02-25",
      "2026-02-26",
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });
});
