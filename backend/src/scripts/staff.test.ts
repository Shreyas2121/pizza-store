import { describe, expect, it } from "vitest";
import {
  assertDevelopmentSeedEnvironment,
  parseStaffSeedArgs,
} from "./staff";

describe("staff seed configuration", () => {
  it("parses normalized, explicit assignments", () => {
    expect(parseStaffSeedArgs([
      "--actor=ADMIN@example.com",
      "--store=mumbai-central",
      "--member=manager:Manager@example.com",
      "--member=finance_manager:finance@example.com",
      "--member=payroll_manager:payroll@example.com",
      "--member=inventory_staff:stock@example.com",
    ])).toEqual({
      actorEmail: "admin@example.com",
      storeSlug: "mumbai-central",
      assignments: [
        { role: "manager", email: "manager@example.com" },
        { role: "finance_manager", email: "finance@example.com" },
        { role: "payroll_manager", email: "payroll@example.com" },
        { role: "inventory_staff", email: "stock@example.com" },
      ],
    });
  });

  it.each([
    ["missing actor", ["--store=one", "--member=operator:user@example.com"]],
    ["unknown role", ["--actor=admin@example.com", "--store=one", "--member=owner:user@example.com"]],
    ["duplicate user", ["--actor=admin@example.com", "--store=one", "--member=operator:user@example.com", "--member=manager:USER@example.com"]],
  ])("rejects %s", (_name, args) => {
    expect(() => parseStaffSeedArgs(args)).toThrow();
  });

  it("refuses non-development environments", () => {
    expect(() => assertDevelopmentSeedEnvironment("production")).toThrow("development-only");
    expect(() => assertDevelopmentSeedEnvironment("test")).toThrow("development-only");
    expect(() => assertDevelopmentSeedEnvironment("development")).not.toThrow();
  });
});
