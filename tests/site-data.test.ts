import assert from "node:assert/strict";
import test from "node:test";
import { formatDate } from "../site-src/src/lib/site-data.js";

test("site dates are invariant across build timezones", () => {
  const originalTimezone = process.env.TZ;

  try {
    process.env.TZ = "UTC";
    const utcOutput = formatDate("2026-03-08T23:30:00.000Z");

    process.env.TZ = "Australia/Brisbane";
    const brisbaneOutput = formatDate("2026-03-08T23:30:00.000Z");

    assert.equal(utcOutput, "Mar 8, 2026");
    assert.equal(brisbaneOutput, utcOutput);
  } finally {
    process.env.TZ = originalTimezone;
  }
});
