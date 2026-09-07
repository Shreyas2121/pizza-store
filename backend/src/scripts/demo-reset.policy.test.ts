import { describe, expect, it } from "vitest";
import { assertDemoResetSafety, buildDemoTruncateSql, DEMO_RESET_CONFIRMATION, quoteSqlIdentifier } from "./demo-reset.policy";

describe("demo reset safety", () => {
  const safe = { nodeEnv: "development", databaseUrl: "postgresql://user:password@localhost:5432/pizzastore", confirmation: DEMO_RESET_CONFIRMATION };

  it("allows only an explicitly confirmed local development database", () => {
    expect(() => assertDemoResetSafety(safe)).not.toThrow();
    expect(() => assertDemoResetSafety({ ...safe, databaseUrl: "postgresql://user:password@[::1]:5432/pizzastore" })).not.toThrow();
    expect(() => assertDemoResetSafety({ ...safe, nodeEnv: "production" })).toThrow("development-only");
    expect(() => assertDemoResetSafety({ ...safe, databaseUrl: "postgresql://user:password@example.com/pizzastore" })).toThrow("local PostgreSQL");
    expect(() => assertDemoResetSafety({ ...safe, confirmation: undefined })).toThrow(DEMO_RESET_CONFIRMATION);
    expect(() => assertDemoResetSafety({ ...safe, databaseUrl: "postgresql://user:password@localhost/postgres" })).toThrow("maintenance database");
  });

  it("quotes and sorts discovered tables instead of interpolating unchecked names", () => {
    expect(quoteSqlIdentifier('odd"table')).toBe('"odd""table"');
    expect(buildDemoTruncateSql(["users", "audit_logs"])).toBe('TRUNCATE TABLE "audit_logs", "users" RESTART IDENTITY CASCADE');
    expect(() => buildDemoTruncateSql([])).toThrow("No public application tables");
  });
});
