import { describe, expect, it } from "vitest";
import { validateCustomizationSelection } from "./customize.logic";
import { customizationGroupSchema, customizationOptionSchema, customizationMappingSchema } from "./customize.schemas";

const group = { name: "Crust", type: "single" as const, required: false, options: [{ id: 1, isAvailable: true }, { id: 2, isAvailable: true }, { id: 3, isAvailable: false }] };
describe("customization authoring inputs", () => {
  it("trims names and validates selection types", () => {
    expect(customizationGroupSchema.parse({ name: " Crust ", type: "single" }).name).toBe("Crust");
    expect(customizationGroupSchema.safeParse({ name: " ", type: "single" }).success).toBe(false);
    expect(customizationGroupSchema.safeParse({ name: "Crust", type: "invalid" }).success).toBe(false);
  });
  it("accepts included options and rejects invalid group IDs and price bounds", () => {
    expect(customizationOptionSchema.parse({ name: "Thin", groupId: 1 }).pricePaise).toBe(0);
    for (const pricePaise of [-1, 50001, 1.5]) expect(customizationOptionSchema.safeParse({ name: "Thin", groupId: 1, pricePaise }).success).toBe(false);
    expect(customizationOptionSchema.safeParse({ name: "Thin", groupId: 0 }).success).toBe(false);
    expect(customizationMappingSchema.safeParse({ groupId: 1, productIds: [1, "2"] }).success).toBe(false);
  });
});
describe("customer selections", () => {
  it("allows skipping optional groups but requires a choice in required groups", () => {
    expect(() => validateCustomizationSelection([group], [])).not.toThrow();
    expect(() => validateCustomizationSelection([{ ...group, required: true }], [])).toThrow("Choose an option");
    expect(() => validateCustomizationSelection([{ ...group, required: true }], [1])).not.toThrow();
  });
  it("enforces single and multiple selection limits", () => {
    expect(() => validateCustomizationSelection([group], [1, 2])).toThrow("only one");
    expect(() => validateCustomizationSelection([{ ...group, type: "multiple" }], [1, 2])).not.toThrow();
  });
  it("rejects unavailable, unrelated and repeated options", () => {
    for (const ids of [[3], [999], [1, 1]]) expect(() => validateCustomizationSelection([group], ids)).toThrow();
  });
});
