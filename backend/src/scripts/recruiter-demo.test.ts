import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { eq, getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as schema from "../db/schema";
import type { TransactionType } from "../utils/types";
import { buildRecruiterPlan, describeSeedError, main, monthEnd, seedShowcase, shiftReferenceDate } from "./recruiter-demo";

describe("recruiter showcase plan", () => {
  it("rolls reporting dates across years and clamps month ends", () => {
    expect(shiftReferenceDate("2026-08-31", "2026-10-10")).toBe("2026-09-30");
    expect(shiftReferenceDate("2026-07", "2027-01-05")).toBe("2026-11");
    expect(shiftReferenceDate("2026-08-31T12:00:00Z", "2028-03-05")).toBe("2028-02-29T12:00:00Z");
    expect(monthEnd("2027-02")).toBe("2027-02-28");
    expect(() => buildRecruiterPlan("2026-02-30")).toThrow();
  });
  it("preserves integer money, line totals and deterministic history", () => {
    const plan = buildRecruiterPlan("2026-10-10");
    expect(plan).toEqual(buildRecruiterPlan("2026-10-10"));
    expect(new Set(plan.orders.map(order => order.id)).size).toBe(plan.orders.length);
    expect(plan.orders.filter(order => order.businessDate === plan.asOf)).toHaveLength(4);
    for (const order of plan.orders) {
      expect(order.items.reduce((sum, item) => sum + item.lineSubtotalPaise, 0)).toBe(order.itemsSubtotalPaise);
      expect(order.taxableAmountPaise + order.taxPaise + order.roundingAdjustmentPaise).toBe(order.grandTotalPaise);
      expect(order.itemsSubtotalPaise - order.discountPaise + order.deliveryFeePaise + order.roundingAdjustmentPaise).toBe(order.grandTotalPaise);
      expect(order.businessDate <= plan.asOf).toBe(true);
      for (const item of order.items) {
        expect(Number.isSafeInteger(item.lineTotalPaise)).toBe(true);
        expect(item.totalCostPaise).toBe(order.status === "delivered" ? (item.unitCostPaise + (item.customizationCostPaise ?? 0)) * item.quantity : 0);
      }
    }
  });
  it("rejects invalid CLI flags before creating a database connection", async () => {
    await expect(main(["--apply", "--plan"])).rejects.toThrow("Usage");
    await expect(main(["--reset"])).rejects.toThrow("Usage");
  });
  it("reports the PostgreSQL cause without dumping query parameters", () => {
    const cause = Object.assign(new Error("posted journal lines are immutable"), { code: "55000" });
    expect(describeSeedError(new Error("Failed query: insert ... params: private", { cause }))).toBe("[55000] posted journal lines are immutable");
  });
});

describe("complete seed against isolated PostgreSQL", () => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  let assetRoot: string;
  const files: string[] = [];
  let admin: typeof schema.usersTable.$inferSelect;
  beforeAll(async () => {
    assetRoot = await mkdtemp(path.join(tmpdir(), "pizzastore-recruiter-"));
    const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
    for (const statement of statements) await client.exec(statement);
    // Drizzle's schema snapshots omit custom functions/triggers. Apply the real
    // posting kernel migration so this database enforces production immutability.
    await client.exec(await readFile(path.resolve(__dirname, "../..", "migrations/0023_balanced_posting_kernel.sql"), "utf8"));
    [admin] = await db.insert(schema.usersTable).values({ fname: "Existing", lname: "Owner", email: "owner@example.test", password: "unchanged-existing-hash", role: "admin", tokenVersion: 7 }).returning();
  }, 60000);
  afterAll(async () => {
    await client.close();
    if (assetRoot) await rm(assetRoot, { recursive: true, force: true });
  });

  it("rejects another owner's data and rolls the transaction back", async () => {
    await expect(db.transaction(async tx => {
      await tx.insert(schema.categoriesTable).values({ name: "Existing owner's category" });
      return seedShowcase(tx as unknown as TransactionType, buildRecruiterPlan("2026-10-10"), files, admin.email, assetRoot);
    })).rejects.toThrow("contains data");
    expect(await db.select().from(schema.categoriesTable)).toHaveLength(0);
    expect(await db.select().from(schema.usersTable)).toEqual([admin]);
    expect(files).toHaveLength(0);
    await expect(db.transaction(tx => seedShowcase(tx as unknown as TransactionType, buildRecruiterPlan("2026-10-10"), files, "missing-admin@example.test", assetRoot))).rejects.toThrow("existing admin");
  });

  it("populates every table, preserves admin, balances journals and can rerun safely", async () => {
    const plan = buildRecruiterPlan("2026-10-10");
    const result = await db.transaction(tx => seedShowcase(tx as unknown as TransactionType, plan, files, admin.email, assetRoot));
    expect(result).toHaveProperty("orders", 212);
    expect(await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, admin.id))).toEqual([admin]);
    for (const table of Object.values(schema).filter(value => is(value, PgTable))) {
      const result = await db.execute(sql`select count(*)::integer as count from ${table}`);
      expect(Number(result.rows[0].count), getTableName(table)).toBeGreaterThan(0);
    }
    const unbalanced = await db.execute(sql`select journal_entry_id from journal_lines group by journal_entry_id having sum(debit_paise) <> sum(credit_paise)`);
    expect(unbalanced.rows).toHaveLength(0);
    const missingLines = await db.execute(sql`select id from journal_entries where id not in (select journal_entry_id from journal_lines)`);
    expect(missingLines.rows).toHaveLength(0);
    expect(await db.select().from(schema.journalEntriesTable).where(eq(schema.journalEntriesTable.status, "draft"))).toHaveLength(0);
    const [postedEntry] = await db.select().from(schema.journalEntriesTable).limit(1);
    const [account] = await db.select().from(schema.ledgerAccountsTable).limit(1);
    await expect(db.insert(schema.journalLinesTable).values({ journalEntryId: postedEntry.id, lineNumber: 99, accountId: account.id, debitPaise: 1, creditPaise: 0 })).rejects.toMatchObject({ cause: { code: "55000" } });
    const wrongStock = await db.execute(sql`select sp.id from store_products sp left join inventory_movements im on im.store_product_id = sp.id where sp.on_hand_quantity is not null group by sp.id having sp.on_hand_quantity <> sum(im.quantity_change)`);
    expect(wrongStock.rows).toHaveLength(0);
    const wrongOrder = await db.execute(sql`select o.id from orders o join order_items i on i.order_id = o.id group by o.id having o.items_subtotal_paise <> sum(i.line_subtotal_paise) or o.discount_paise <> sum(i.discount_allocation_paise) or o.tax_paise <> sum(i.tax_paise) + o.delivery_tax_paise`);
    expect(wrongOrder.rows).toHaveLength(0);
    const freshUser = await db.select().from(schema.usersTable).where(eq(schema.usersTable.email, "new.customer@recruiter.pizzastore.test"));
    expect(await db.select().from(schema.ordersTable).where(eq(schema.ordersTable.userId, freshUser[0].id))).toHaveLength(0);
    const attachments = await db.select().from(schema.expenseAttachmentsTable);
    for (const attachment of attachments) expect((await readFile(path.join(assetRoot, ".private", "expense-receipts", attachment.storageKey))).length).toBe(attachment.sizeBytes);
    const countBefore = (await db.select().from(schema.ordersTable)).length;
    const fileCountBefore = files.length;
    // Mimic a demo session changing a seeded record; rerunning must preserve it.
    await db.update(schema.productsTable).set({ name: "Owner edited title" }).where(eq(schema.productsTable.slug, "margherita-pizza"));
    const rerun = await db.transaction(tx => seedShowcase(tx as unknown as TransactionType, plan, files, admin.email, assetRoot));
    expect(rerun).toHaveProperty("alreadySeeded", true);
    expect((await db.select().from(schema.ordersTable)).length).toBe(countBefore);
    expect(files).toHaveLength(fileCountBefore);
    expect((await db.select().from(schema.productsTable).where(eq(schema.productsTable.slug, "margherita-pizza")))[0].name).toBe("Owner edited title");
  }, 60000);
});
