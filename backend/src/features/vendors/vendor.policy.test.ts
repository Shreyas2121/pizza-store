import { describe, expect, it } from "vitest";
import { escapeLikePattern, normalizeMasterName } from "./vendor.policy";

describe("vendor master normalization", () => {
  it("normalizes compatibility characters, casing, and whitespace deterministically", () => {
    expect(normalizeMasterName("  ACME\tＦＯＯＤＳ  ")).toBe("acme foods");
  });

  it("escapes SQL LIKE wildcard characters", () => {
    expect(escapeLikePattern("50%_off\\today")).toBe("50\\%\\_off\\\\today");
  });
});
