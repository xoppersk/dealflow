import { describe, expect, it } from "vitest";

import { DEFAULT_STALE_THRESHOLD_DAYS, isStaleDeal, wholeDaysBetween } from "./stale-deals";

const NOW = new Date("2026-10-06T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("isStaleDeal", () => {
  it("flags deals untouched beyond the default 14-day threshold", () => {
    expect(isStaleDeal({ lastTouchedAt: daysAgo(15), now: NOW })).toBe(true);
    expect(isStaleDeal({ lastTouchedAt: daysAgo(21), now: NOW })).toBe(true);
  });

  it("does not flag recently touched deals", () => {
    expect(isStaleDeal({ lastTouchedAt: daysAgo(0), now: NOW })).toBe(false);
    expect(isStaleDeal({ lastTouchedAt: daysAgo(13), now: NOW })).toBe(false);
  });

  it("is strict about the boundary: exactly 14 days is not stale", () => {
    expect(isStaleDeal({ lastTouchedAt: daysAgo(14), now: NOW })).toBe(false);
    expect(
      isStaleDeal({
        lastTouchedAt: new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000 - 1).toISOString(),
        now: NOW,
      }),
    ).toBe(true);
  });

  it("never flags closed deals", () => {
    expect(isStaleDeal({ lastTouchedAt: daysAgo(90), now: NOW, isClosed: true })).toBe(false);
  });

  it("honours a custom threshold", () => {
    expect(isStaleDeal({ lastTouchedAt: daysAgo(8), now: NOW, thresholdDays: 7 })).toBe(true);
    expect(isStaleDeal({ lastTouchedAt: daysAgo(6), now: NOW, thresholdDays: 7 })).toBe(false);
  });

  it("accepts Date objects as well as ISO strings", () => {
    expect(isStaleDeal({ lastTouchedAt: daysAgo(30), now: NOW })).toBe(true);
  });

  it("treats future touches (clock skew) as not stale", () => {
    const future = new Date(NOW.getTime() + 60_000).toISOString();
    expect(isStaleDeal({ lastTouchedAt: future, now: NOW })).toBe(false);
  });

  it("defaults to a 14-day threshold", () => {
    expect(DEFAULT_STALE_THRESHOLD_DAYS).toBe(14);
  });
});

describe("wholeDaysBetween", () => {
  it("floors partial days", () => {
    expect(wholeDaysBetween("2026-10-01T00:00:00Z", "2026-10-06T12:00:00Z")).toBe(5);
  });

  it("handles timezone boundaries consistently (UTC instants)", () => {
    // 23:30 UTC Oct 5 → 00:30 UTC Oct 6 is 1 hour, not 1 day.
    expect(wholeDaysBetween("2026-10-05T23:30:00Z", "2026-10-06T00:30:00Z")).toBe(0);
  });
});
