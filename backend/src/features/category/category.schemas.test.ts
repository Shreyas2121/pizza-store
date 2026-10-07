import { describe, expect, it } from "vitest";
import { categoryCreateSchema } from "./category.schemas";

describe("category creation input", () => {
  it("trims category names", () => { expect(categoryCreateSchema.parse({ name: "  Sides  " })).toEqual({ name: "Sides" }); });
  it("rejects blank, oversized and non-string names", () => {
    for (const name of ["   ", "x".repeat(101), 42, null]) expect(categoryCreateSchema.safeParse({ name }).success).toBe(false);
  });
});
