import { describe, expect, it } from "vitest";

import {
  effectiveProbability,
  forecastByCloseMonth,
  forecastTotal,
  weightedValue,
  winRate,
} from "./forecast";

describe("effectiveProbability", () => {
  it("prefers the deal's own probability when set", () => {
    expect(effectiveProbability(60, 25)).toBe(60);
  });

  it("falls back to the stage default when the deal has none", () => {
    expect(effectiveProbability(null, 25)).toBe(25);
  });

  it("clamps to 0–100", () => {
    expect(effectiveProbability(150, 25)).toBe(100);
    expect(effectiveProbability(-10, 25)).toBe(0);
    expect(effectiveProbability(null, 999)).toBe(100);
  });
});

describe("weightedValue", () => {
  it("computes value × probability", () => {
    expect(weightedValue(48_500, 50)).toBe(24_250);
    expect(weightedValue(10_000, 100)).toBe(10_000);
    expect(weightedValue(10_000, 0)).toBe(0);
  });

  it("treats negative values as zero", () => {
    expect(weightedValue(-500, 50)).toBe(0);
  });
});

describe("forecastTotal", () => {
  it("sums weighted values with stage-default fallback", () => {
    const total = forecastTotal([
      { value: 100_000, probability: 50, stageDefaultProbability: 25 }, // 50,000
      { value: 40_000, probability: null, stageDefaultProbability: 25 }, // 10,000
    ]);
    expect(total).toBe(60_000);
  });

  it("is zero for an empty pipeline", () => {
    expect(forecastTotal([])).toBe(0);
  });
});

describe("winRate", () => {
  it("computes won / (won + lost)", () => {
    expect(winRate(3, 1)).toBe(0.75);
  });

  it("is zero when nothing has closed", () => {
    expect(winRate(0, 0)).toBe(0);
  });
});

describe("forecastByCloseMonth", () => {
  it("buckets weighted forecast by YYYY-MM, sorted ascending", () => {
    const rows = forecastByCloseMonth([
      { value: 100_000, probability: 50, stageDefaultProbability: 25, closeDate: "2026-11-15" },
      { value: 40_000, probability: null, stageDefaultProbability: 25, closeDate: "2026-10-20" },
      { value: 20_000, probability: 100, stageDefaultProbability: 75, closeDate: "2026-10-05" },
      { value: 5_000, probability: 50, stageDefaultProbability: 25, closeDate: null }, // skipped
    ]);
    expect(rows.map((r) => r.month)).toEqual(["2026-10", "2026-11"]);
    expect(rows[0]).toMatchObject({ weighted: 30_000, raw: 60_000, count: 2 });
    expect(rows[1]).toMatchObject({ weighted: 50_000, raw: 100_000, count: 1 });
  });

  it("ignores malformed close dates", () => {
    const rows = forecastByCloseMonth([
      { value: 1_000, probability: 50, stageDefaultProbability: 25, closeDate: "not-a-date" },
    ]);
    expect(rows).toEqual([]);
  });
});
