import { describe, expect, it } from "vitest";

import { urgencyBadgeClasses, urgencyForDaysInStage, urgencyLabel } from "./urgency";

describe("urgencyForDaysInStage", () => {
  it("is slate (on-track) under 7 days", () => {
    expect(urgencyForDaysInStage(0)).toBe("on-track");
    expect(urgencyForDaysInStage(6)).toBe("on-track");
  });

  it("is amber (watch) from 7 to 14 days inclusive", () => {
    expect(urgencyForDaysInStage(7)).toBe("watch");
    expect(urgencyForDaysInStage(14)).toBe("watch");
  });

  it("is red (act) beyond 14 days", () => {
    expect(urgencyForDaysInStage(15)).toBe("act");
    expect(urgencyForDaysInStage(21)).toBe("act");
  });
});

describe("urgencyBadgeClasses", () => {
  it("returns distinct classes per level with dark-mode variants", () => {
    const onTrack = urgencyBadgeClasses("on-track");
    const watch = urgencyBadgeClasses("watch");
    const act = urgencyBadgeClasses("act");
    expect(new Set([onTrack, watch, act]).size).toBe(3);
    for (const c of [onTrack, watch, act]) {
      expect(c).toMatch(/dark:/);
    }
  });
});

describe("urgencyLabel", () => {
  it("produces human labels with singular/plural days", () => {
    expect(urgencyLabel("on-track", 1)).toMatch(/1 day/);
    expect(urgencyLabel("act", 21)).toMatch(/21 days/);
  });
});
