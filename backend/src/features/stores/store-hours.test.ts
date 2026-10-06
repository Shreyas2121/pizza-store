import { describe, expect, it } from "vitest";
import { isStoreOpen } from "./store-hours";

describe("store timezone opening hours", () => {
  it("preserves the default IST policy while accepting a selected store timezone", () => {
    const instant = new Date("2026-10-06T04:00:00Z");
    expect(isStoreOpen("09:00", "10:00", instant)).toBe(true);
    expect(isStoreOpen("09:00", "10:00", instant, "UTC")).toBe(false);
  });
  it("keeps overnight boundaries half open in the store timezone", () => {
    expect(isStoreOpen("22:00", "02:00", new Date("2026-10-06T22:00:00Z"), "UTC")).toBe(true);
    expect(isStoreOpen("22:00", "02:00", new Date("2026-10-07T02:00:00Z"), "UTC")).toBe(false);
  });
  it("uses the daylight-saving offset for the selected date", () => {
    expect(isStoreOpen("09:00", "10:00", new Date("2026-07-01T13:30:00Z"), "America/New_York")).toBe(true);
    expect(isStoreOpen("09:00", "10:00", new Date("2026-01-01T13:30:00Z"), "America/New_York")).toBe(false);
  });
});
