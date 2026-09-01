import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  pgTable,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { storesTable } from "./store.schema";

export type DemoTaxComponent = "item" | "delivery";

export const DEMO_TAX_DISCLAIMER =
  "Portfolio demo — not a statutory tax invoice" as const;

export const taxRulesTable = pgTable(
  "tax_rules",
  {
    id,
    storeId: integer("store_id")
      .references(() => storesTable.id)
      .notNull(),
    component: text().$type<DemoTaxComponent>().notNull(),
    version: integer().notNull(),
    rateBps: integer("rate_bps").notNull(),
    hsnSacCode: text("hsn_sac_code").notNull(),
    isDemo: boolean("is_demo").notNull().default(true),
    disclaimer: text().notNull().default(DEMO_TAX_DISCLAIMER),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("tax_rules_store_component_version_unique").on(
      table.storeId,
      table.component,
      table.version
    ),
    unique("tax_rules_store_component_effective_from_unique").on(
      table.storeId,
      table.component,
      table.effectiveFrom
    ),
    check(
      "tax_rules_component_valid",
      sql`${table.component} in ('item', 'delivery')`
    ),
    check("tax_rules_version_positive", sql`${table.version} > 0`),
    check("tax_rules_rate_valid", sql`${table.rateBps} between 0 and 10000`),
    check(
      "tax_rules_hsn_sac_code_present",
      sql`nullif(btrim(${table.hsnSacCode}), '') is not null`
    ),
    check("tax_rules_demo_only", sql`${table.isDemo} = true`),
    check(
      "tax_rules_disclaimer_exact",
      sql`${table.disclaimer} = 'Portfolio demo — not a statutory tax invoice'`
    ),
    check(
      "tax_rules_effective_range_valid",
      sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`
    ),
  ]
);
