import { describe, expect, it } from "vitest";
import {
  CLEAR_ALL_CONFIRMATION,
  clearAllDataSchema,
} from "./system-maintenance.schemas";

describe("clear-all confirmation validation", () => {
  it("accepts only the exact destructive confirmation phrase", () => {
    expect(
      clearAllDataSchema.parse({ confirmation: CLEAR_ALL_CONFIRMATION })
    ).toEqual({ confirmation: "CLEAR EVERYTHING" });
    expect(() =>
      clearAllDataSchema.parse({ confirmation: "clear everything" })
    ).toThrow();
    expect(() => clearAllDataSchema.parse({})).toThrow();
  });
});
