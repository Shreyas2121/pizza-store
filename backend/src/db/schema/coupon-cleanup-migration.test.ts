import { readFileSync } from "node:fs";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./index";

type Snapshot = { tables: Record<string, { columns: Record<string, unknown>; foreignKeys: Record<string, unknown> }> };
const readSnapshot = (version: string): Snapshot => JSON.parse(readFileSync(new URL(`../../../migrations/meta/${version}_snapshot.json`, import.meta.url), "utf8"));
const previous = readSnapshot("0029");
const current = readSnapshot("0030");
const sql = readFileSync(new URL("../../../migrations/0030_remove_legacy_coupons.sql", import.meta.url), "utf8");

describe("coupon persistence cleanup migration", () => {
  it("removes only retired tables, order column and foreign key from the additive foundation", () => {
    expect(Object.keys(previous.tables).filter((name) => !(name in current.tables)).sort())
      .toEqual(["public.coupon_redemptions", "public.coupons"]);
    expect(Object.keys(current.tables)).toHaveLength(Object.keys(previous.tables).length - 2);
    for (const [name, table] of Object.entries(current.tables)) {
      if (name === "public.orders") {
        const { coupon_id: retiredColumn, ...columns } = previous.tables[name].columns;
        const { orders_coupon_id_coupons_id_fk: retiredForeignKey, ...foreignKeys } = previous.tables[name].foreignKeys;
        expect(retiredColumn).toBeDefined();
        expect(retiredForeignKey).toBeDefined();
        expect(table).toEqual({ ...previous.tables[name], columns, foreignKeys });
      } else expect(table).toEqual(previous.tables[name]);
    }
    expect(Object.keys(current.tables).sort()).toEqual(Object.values(schema)
      .filter((value) => is(value, PgTable)).map((table) => `public.${getTableName(table)}`).sort());
  });

  it("drops the referencing FK and child table before the parent without CASCADE", () => {
    expect(sql.match(/(?:ALTER|DROP) TABLE/g)).toHaveLength(4);
    expect(sql.indexOf('DROP CONSTRAINT "orders_coupon_id_coupons_id_fk"')).toBeLessThan(sql.indexOf('DROP TABLE "coupons"'));
    expect(sql.indexOf('DROP TABLE "coupon_redemptions"')).toBeLessThan(sql.indexOf('DROP TABLE "coupons"'));
    expect(sql).toContain('ALTER TABLE "orders" DROP COLUMN "coupon_id"');
    expect(sql).not.toContain("CASCADE");
    const journal = JSON.parse(readFileSync(new URL("../../../migrations/meta/_journal.json", import.meta.url), "utf8")) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries.at(-1)).toMatchObject({ idx: 30, tag: "0030_remove_legacy_coupons" });
  });
});
