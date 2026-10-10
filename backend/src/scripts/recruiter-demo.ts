/** One entry point for the recruiter demo. No existing seed script is invoked.
 * Run with --plan (default) or --apply. See docs/recruiter-demo.md. */
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import bcrypt from "bcryptjs";
import { promotionDefinitionWriteSchema, type PromotionDefinitionWriteInput } from "../features/promotions/promotion.schemas";
import { definitionToValues, rulesToValues } from "../features/promotions/promotion.mapper";
import { PROMOTION_DESKTOP_MIN_HEIGHT, PROMOTION_DESKTOP_MIN_WIDTH, PROMOTION_MOBILE_MIN_HEIGHT, PROMOTION_MOBILE_MIN_WIDTH, PROMOTION_MEDIA_DIRECTORY, PROMOTION_MEDIA_URL_PREFIX } from "../features/promotions/promotion.constants";
import path from "node:path";
import { access, mkdir, writeFile, unlink } from "node:fs/promises";
import { is, getTableName, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../db/schema/index";
import { SYSTEM_LEDGER_ACCOUNTS } from "../features/ledger/ledger.accounts";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  cashMovementsTable,
  cashSessionClosuresTable,
  cashSessionsTable,
  compensationComponentsTable,
  compensationVersionsTable,
  promotionsTable,
  promotionApplicationsTable,
  promotionDiscountAllocationsTable,
  deliveryPricingRulesTable,
  employeeFinanceProfilesTable,
  expenseAllocationsTable,
  expenseCategoriesTable,
  expensesTable,
  financialOutboxTable,
  fiscalPeriodsTable,
  journalEntriesTable,
  journalLinesTable,
  ledgerAccountsTable,
  orderItemsTable,
  ordersTable,
  paymentAttemptsTable,
  paymentsTable,
  payRunEmployeesTable,
  payRunLinesTable,
  payRunsTable,
  productCostVersionsTable,
  productsTable,
  refundAllocationsTable,
  refundsTable,
  settlementBatchesTable,
  settlementLinesTable,
  storeProductsTable,
  taxRulesTable,
} from "../db/schema/index";
import {
  FIXTURE_EMPLOYEES as BASE_EMPLOYEES,
  FIXTURE_EXPENSES as BASE_EXPENSES,
  FIXTURE_ORDERS as BASE_ORDERS,
  FIXTURE_PAY_RUNS as BASE_PAY_RUNS,
  FIXTURE_SETTLEMENTS as BASE_SETTLEMENTS,
  FIXTURE_STANDARD_COSTS as BASE_STANDARD_COSTS,
} from "../fixtures/financial-scenario.fixtures";
import { hashPostingCommand, validatePostingCommand } from "../features/ledger/ledger.policy";
import type { PostingCommand } from "../features/ledger/ledger.types";
import { buildCapturedPaymentPosting, buildDeliveredOrderPosting } from "../features/ledger/commerce-posting.policy";
import { buildCashClosurePosting, buildExpensePosting } from "../features/ledger/cash-expense-posting.policy";
import { buildPayRunPosting } from "../features/ledger/payroll-posting.policy";
import { buildDisbursedRefundPosting, buildProcessedRefundPosting, buildSettlementPosting } from "../features/ledger/refund-settlement-posting.policy";
import { hashFinancialEvent } from "../features/finance-events/financial-event.policy";
import type { FinancialEventType, WriteFinancialEventInput } from "../features/finance-events/financial-event.types";
import type { TransactionType } from "../utils/types";
import { buildDeliveredOrderPayload } from "../features/finance-events/order-recognition.payload";
import { calculateInclusiveTax } from "../utils/money";

const SEEDED_AT = new Date();
const COMPLETION_ACTION = "recruiter.seed.completed.v1";
const PASSWORD = "RecruiterDemo!2026";
const BACKEND_ROOT = path.resolve(__dirname, "../..");

export function monthEnd(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
}

/** Anchor the reference's July/August to the two completed months before asOf. */
export function shiftReferenceDate(value: string, asOf: string): string {
  if (!/^\d{4}-\d{2}(?:-\d{2}(?:T.*)?)?$/.test(value)) return value;
  const offset = Number(asOf.slice(0, 4)) * 12 + Number(asOf.slice(5, 7)) - (2026 * 12 + 9);
  const [year, month] = value.slice(0, 7).split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + offset, 1));
  const targetMonth = first.toISOString().slice(0, 7);
  if (value.length === 7) return targetMonth;
  const day = Math.min(Number(value.slice(8, 10)), Number(monthEnd(targetMonth).slice(8, 10)));
  return `${targetMonth}-${String(day).padStart(2, "0")}${value.slice(10)}`;
}

function shiftFixtures<T>(values: T, asOf: string): T {
  const visit = (value: unknown): unknown => {
    if (typeof value === "string") return shiftReferenceDate(value, asOf);
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
    return value;
  };
  return visit(values) as T;
}

export function buildRecruiterPlan(asOf = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf)) || new Date(`${asOf}T00:00:00Z`).toISOString().slice(0, 10) !== asOf) throw new Error("--as-of must be a valid YYYY-MM-DD date.");
  const orders = shiftFixtures(BASE_ORDERS, asOf);
  const templates = orders.filter(order => order.status === "delivered" && !order.couponCode && !order.refundPaise);
  const costs = shiftFixtures(BASE_STANDARD_COSTS, asOf);
  for (let index = 0; index < 200; index++) {
    const template = structuredClone(templates[index % templates.length]);
    // Cover 60 recent days, including today's default dashboard filters.
    const day = new Date(`${asOf}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - index % 60);
    template.id = 1000 + index;
    template.orderNumber = `SHOWCASE-${template.id}`;
    template.businessDate = day.toISOString().slice(0, 10);
    template.placedAt = `${template.businessDate}T03:${String(index % 60).padStart(2, "0")}:00.000Z`;
    template.storeId = Math.floor(index / 60) % 2 + 1;
    template.paymentMethod = "razorpay";
    template.paymentStatus = "completed";
    for (const item of template.items) {
      const cost = costs.filter(row => row.productId === item.productId && row.effectiveFrom <= template.businessDate && (!row.effectiveTo || row.effectiveTo >= template.businessDate)).at(-1);
      if (!cost) throw new Error("Reference history has no applicable cost version.");
      item.unitCostPaise = cost.unitCostPaise;
      item.totalCostPaise = (item.unitCostPaise + (item.customizationCostPaise ?? 0)) * item.quantity;
    }
    template.cogsPaise = template.items.reduce((sum, item) => sum + item.totalCostPaise, 0);
    orders.push(template);
  }
  return { asOf, orders, customers: 24, stores: 2, password: PASSWORD };
}
type RecruiterPlan = ReturnType<typeof buildRecruiterPlan>;

const HASH = createHash("sha256").update("pizzastore-deterministic-finance-demo").digest("hex");

type DemoScenarioInput = {
  adminId: number;
  customerId: number;
  customers: Array<{ id: number; addresses: number[] }>;
  financeId: number;
  storeIds: [number, number];
};

export type DemoScenarioResult = {
  reportingPeriods: [string, string];
  orderIds: Record<number, number>;
  paymentAttemptIds: Record<number, number>;
  refundId: number;
  settlementIds: Record<string, number>;
  cashSessionId: number;
  expenseIds: Record<number, number>;
  payRunIds: Record<number, number>;
  journalCount: number;
};

const productSlugByFixtureId: Record<number, string> = {
  10: "margherita-pizza",
  20: "pepperoni-feast",
  30: "veggie-supreme",
  40: "garlic-breadsticks",
  50: "coca-cola",
};

// Treat hours as local store time; financial business dates use Asia/Kolkata.
const isoDateTime = (businessDate: string, hour = 12) => new Date(new Date(`${businessDate}T00:00:00Z`).getTime() + (hour * 60 - 330) * 60000);

const seedEvent = async (
  tx: TransactionType,
  input: WriteFinancialEventInput,
  command?: PostingCommand | null,
) => {
  const eventId = `demo:${input.eventType}:${input.storeId}:${input.sourceId}:${input.sourceVersion}`;
  const payloadHash = hashFinancialEvent(input);
  const [event] = await tx.insert(financialOutboxTable).values({
    ...input,
    sourceId: String(input.sourceId),
    eventId,
    payloadHash,
    status: "processed",
    attemptCount: 1,
    availableAt: input.occurredAt,
    processedAt: input.occurredAt,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  }).returning();

  if (!command) return undefined;
  validatePostingCommand(command);
  const debit = command.lines.reduce((sum, line) => sum + (line.side === "debit" ? line.amountPaise : 0), 0);
  const credit = command.lines.reduce((sum, line) => sum + (line.side === "credit" ? line.amountPaise : 0), 0);
  if (debit !== credit) throw new Error(`Demo journal for ${eventId} is not balanced.`);

  const codes = [...new Set(command.lines.map((line) => line.accountCode))];
  const accounts = await tx.select().from(ledgerAccountsTable).where(inArray(ledgerAccountsTable.code, codes));
  const accountByCode = new Map(accounts.map((account) => [account.code, account.id]));
  if (accountByCode.size !== codes.length) throw new Error(`Demo journal for ${eventId} references a missing account.`);

  const [entry] = await tx.insert(journalEntriesTable).values({
    storeId: command.storeId,
    journalNumber: `DEMO-${String(event.id).padStart(4, "0")}`,
    businessDate: command.businessDate,
    occurredAt: command.occurredAt,
    description: command.description,
    currency: command.currency,
    sourceType: command.source.sourceType,
    sourceId: String(command.source.sourceId),
    eventType: command.source.eventType,
    sourceVersion: command.source.sourceVersion,
    commandHash: hashPostingCommand(command),
    status: "draft",
    postedBy: command.postedBy ?? null,
    postedAt: null,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  }).returning({ id: journalEntriesTable.id });
  await tx.insert(journalLinesTable).values(command.lines.map((line, index) => ({
    journalEntryId: entry.id,
    lineNumber: index + 1,
    accountId: accountByCode.get(line.accountCode)!,
    debitPaise: line.side === "debit" ? line.amountPaise : 0,
    creditPaise: line.side === "credit" ? line.amountPaise : 0,
    description: line.description ?? null,
    orderId: line.orderId ?? null,
    paymentAttemptId: line.paymentAttemptId ?? null,
    refundId: line.refundId ?? null,
    expenseId: line.expenseId ?? null,
    payRunId: line.payRunId ?? null,
    dimensions: line.metadata ?? {},
    createdAt: SEEDED_AT,
  })));
  // Posted journals are immutable: their lines must exist while the entry is a draft.
  // The posting update also lets the database trigger verify the final balance.
  await tx.update(journalEntriesTable).set({
    status: "posted",
    postedAt: command.occurredAt,
    updatedAt: SEEDED_AT,
  }).where(eq(journalEntriesTable.id, entry.id));
  return entry.id;
};

const eventInput = (values: {
  eventType: FinancialEventType;
  sourceType: string;
  sourceId: number | string;
  sourceVersion?: number;
  storeId: number;
  businessDate: string;
  occurredAt?: Date;
  actorId: number;
  payload: Record<string, unknown>;
}): WriteFinancialEventInput => ({
  eventType: values.eventType,
  schemaVersion: 1,
  sourceType: values.sourceType,
  sourceId: values.sourceId,
  sourceVersion: values.sourceVersion ?? 1,
  storeId: values.storeId,
  currency: "INR",
  occurredAt: values.occurredAt ?? isoDateTime(values.businessDate),
  businessDate: values.businessDate,
  timezone: "Asia/Kolkata",
  actorId: values.actorId,
  correlationId: `demo:${values.sourceType}:${values.sourceId}`,
  payload: values.payload,
});

const asEvent = (input: WriteFinancialEventInput) => ({
  id: 1,
  eventId: "demo-preview",
  ...input,
  sourceId: String(input.sourceId),
  actorId: input.actorId ?? null,
  correlationId: input.correlationId ?? null,
  causationId: input.causationId ?? null,
  payloadHash: HASH,
  status: "processed" as const,
  attemptCount: 1,
  availableAt: input.occurredAt,
  claimedAt: null,
  claimedBy: null,
  processedAt: input.occurredAt,
  lastError: null,
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
});

const categoryData = [
  { name: "Pizza", featured: true },
  { name: "Pasta", featured: true },
  { name: "Sides", featured: false },
  { name: "Beverages", featured: false },
  { name: "Chicken", featured: true },
];

const productData = [
  {
    name: "Margherita Pizza",
    description:
      "Classic delight with mozzarella cheese, fresh basil, and tangy tomato sauce on a crispy crust.",
    slug: "margherita-pizza",
    veg: true,
    hasCustomization: true,
    pricePaise: 29_900,
    image: "/uploads/pizza-1.avif",
    category: "Pizza",
  },
  {
    name: "Pepperoni Feast",
    description:
      "Loaded with spicy pepperoni slices, mozzarella, and our signature pizza sauce.",
    slug: "pepperoni-feast",
    veg: false,
    hasCustomization: true,
    pricePaise: 44_900,
    image: "/uploads/pizza-2.avif",
    category: "Pizza",
  },
  {
    name: "BBQ Chicken Pizza",
    description:
      "Smoky BBQ sauce with grilled chicken, red onions, and a blend of cheeses.",
    slug: "bbq-chicken-pizza",
    veg: false,
    hasCustomization: true,
    pricePaise: 49_900,
    image: "/uploads/pizza-3.avif",
    category: "Pizza",
  },
  {
    name: "Veggie Supreme",
    description:
      "A garden-fresh medley of bell peppers, olives, mushrooms, onions, and sweet corn.",
    slug: "veggie-supreme",
    veg: true,
    hasCustomization: true,
    pricePaise: 39_900,
    image: "/uploads/pizza-4.webp",
    category: "Pizza",
  },
  {
    name: "Farmhouse Pizza",
    description:
      "Topped with capsicum, mushrooms, onions, and fresh tomatoes on a cheesy base.",
    slug: "farmhouse-pizza",
    veg: true,
    hasCustomization: true,
    pricePaise: 37_900,
    image: "/uploads/pizza-5.avif",
    category: "Pizza",
  },
  {
    name: "Meat Lovers Pizza",
    description:
      "A hearty combination of chicken tikka, sausage, pepperoni, and grilled chicken.",
    slug: "meat-lovers-pizza",
    veg: false,
    hasCustomization: true,
    pricePaise: 54_900,
    image: "/uploads/pizza-6.avif",
    category: "Pizza",
  },
  {
    name: "Cheese Burst Pizza",
    description:
      "Extra gooey mozzarella stuffed crust with a triple cheese topping.",
    slug: "cheese-burst-pizza",
    veg: true,
    hasCustomization: true,
    pricePaise: 42_900,
    image: "/uploads/pizza-7.avif",
    category: "Pizza",
  },
  {
    name: "Creamy Alfredo Pasta",
    description:
      "Penne in a rich and creamy Alfredo sauce with garlic, parmesan, and herbs.",
    slug: "creamy-alfredo-pasta",
    veg: true,
    hasCustomization: false,
    pricePaise: 24_900,
    image: "/uploads/pasta.avif",
    category: "Pasta",
  },
  {
    name: "Garlic Breadsticks",
    description:
      "Freshly baked breadsticks brushed with garlic butter and sprinkled with herbs.",
    slug: "garlic-breadsticks",
    veg: true,
    hasCustomization: false,
    pricePaise: 14_900,
    image: "/uploads/bread.avif",
    category: "Sides",
  },
  {
    name: "Classic French Fries",
    description:
      "Golden crispy fries seasoned with salt and served with ketchup.",
    slug: "classic-french-fries",
    veg: true,
    hasCustomization: false,
    pricePaise: 12_900,
    image: "/uploads/fries.avif",
    category: "Sides",
  },
  {
    name: "Grilled Chicken Wings",
    description:
      "Juicy chicken wings marinated in spices and grilled to perfection. Served with dipping sauce.",
    slug: "grilled-chicken-wings",
    veg: false,
    hasCustomization: false,
    pricePaise: 29_900,
    image: "/uploads/chicken.avif",
    category: "Chicken",
  },
  {
    name: "Coca-Cola",
    description: "Chilled 300ml can of classic Coca-Cola.",
    slug: "coca-cola",
    veg: true,
    hasCustomization: false,
    pricePaise: 6_000,
    image: "/uploads/coke.avif",
    category: "Beverages",
  },
  {
    name: "Fresh Lemonade",
    description:
      "Refreshing lemonade made with fresh lemons, mint, and a hint of sugar.",
    slug: "fresh-lemonade",
    veg: true,
    hasCustomization: false,
    pricePaise: 9_900,
    image: "/uploads/lemon-drink.avif",
    category: "Beverages",
  },
  {
    name: "Cold Coffee",
    description:
      "Creamy cold coffee blended with milk, coffee, and topped with whipped cream.",
    slug: "cold-coffee",
    veg: true,
    hasCustomization: false,
    pricePaise: 12_900,
    image: "/uploads/coffee.avif",
    category: "Beverages",
  },
  {
    name: "Fruit Punch",
    description:
      "A vibrant mix of tropical fruit juices blended with ice. Refreshing and fruity.",
    slug: "fruit-punch",
    veg: true,
    hasCustomization: false,
    pricePaise: 11_900,
    image: "/uploads/drink.avif",
    category: "Beverages",
  },
];

const customizationData = [
  {
    name: "Size",
    type: "single" as const,
    required: true,
    options: [
      { name: "Regular", pricePaise: 0 },
      { name: "Medium", pricePaise: 10_000 },
      { name: "Large", pricePaise: 20_000 },
    ],
  },
  {
    name: "Crust",
    type: "single" as const,
    required: true,
    options: [
      { name: "Hand Tossed", pricePaise: 0 },
      { name: "Thin Crust", pricePaise: 0 },
      { name: "Cheese Burst", pricePaise: 12_000 },
      { name: "New York Style", pricePaise: 8_000 },
    ],
  },
  {
    name: "Extra Toppings",
    type: "multiple" as const,
    required: false,
    options: [
      { name: "Extra Cheese", pricePaise: 6_000 },
      { name: "Jalapenos", pricePaise: 4_000 },
      { name: "Mushrooms", pricePaise: 5_000 },
      { name: "Olives", pricePaise: 5_000 },
      { name: "Onions", pricePaise: 3_000 },
      { name: "Paneer", pricePaise: 7_000 },
      { name: "Grilled Chicken", pricePaise: 9_000 },
    ],
  },
];

const pizzaSlugs = [
  "margherita-pizza",
  "pepperoni-feast",
  "bbq-chicken-pizza",
  "veggie-supreme",
  "farmhouse-pizza",
  "meat-lovers-pizza",
  "cheese-burst-pizza",
];

const menuData = [
  {
    name: "Pizzas",
    position: 1,
    slug: "pizzas",
    image: "/uploads/pizza-1.avif",
    productSlugs: pizzaSlugs,
  },
  {
    name: "Pasta",
    position: 2,
    slug: "pasta",
    image: "/uploads/pasta.avif",
    productSlugs: ["creamy-alfredo-pasta"],
  },
  {
    name: "Sides",
    position: 3,
    slug: "sides",
    image: "/uploads/fries.avif",
    productSlugs: ["garlic-breadsticks", "classic-french-fries"],
  },
  {
    name: "Chicken",
    position: 4,
    slug: "chicken",
    image: "/uploads/chicken.avif",
    productSlugs: ["grilled-chicken-wings"],
  },
  {
    name: "Beverages",
    position: 5,
    slug: "beverages",
    image: "/uploads/coke.avif",
    productSlugs: [
      "coca-cola",
      "fresh-lemonade",
      "cold-coffee",
      "fruit-punch",
    ],
  },
];


async function seedFinance(tx: TransactionType, input: DemoScenarioInput, plan: RecruiterPlan): Promise<DemoScenarioResult> {
    const moveDate = (value: string) => shiftReferenceDate(value, plan.asOf);
    const FIXTURE_ORDERS = plan.orders;
    const FIXTURE_STANDARD_COSTS = shiftFixtures(BASE_STANDARD_COSTS, plan.asOf);
    const FIXTURE_EXPENSES = shiftFixtures(BASE_EXPENSES, plan.asOf);
    const FIXTURE_PAY_RUNS = shiftFixtures(BASE_PAY_RUNS, plan.asOf);
    const FIXTURE_SETTLEMENTS = shiftFixtures(BASE_SETTLEMENTS, plan.asOf);
    const FIXTURE_EMPLOYEES = BASE_EMPLOYEES;
    const PRICING_POLICY_VERSION = 5;
    const stores = input.storeIds;
    const rules = await tx.select().from(taxRulesTable).where(inArray(taxRulesTable.storeId, stores));
    const deliveryRules = await tx.select().from(deliveryPricingRulesTable).where(inArray(deliveryPricingRulesTable.storeId, stores));
    const products = await tx.select({ id: productsTable.id, slug: productsTable.slug }).from(productsTable);
    const productIdBySlug = new Map(products.map((product) => [product.slug, product.id]));
    const productIdByFixtureId = new Map(Object.entries(productSlugByFixtureId).map(([fixtureId, slug]) => [Number(fixtureId), productIdBySlug.get(slug)!]));
    const storeProducts = await tx.select().from(storeProductsTable).where(inArray(storeProductsTable.storeId, stores));
    const storeProductByKey = new Map(storeProducts.map((row) => [`${row.storeId}:${row.productId}`, row]));

    for (const storeId of stores) {
      for (const cost of FIXTURE_STANDARD_COSTS) {
        const productId = productIdByFixtureId.get(cost.productId)!;
        const storeProduct = storeProductByKey.get(`${storeId}:${productId}`)!;
        await tx.insert(productCostVersionsTable).values({
          storeProductId: storeProduct.id,
          storeId,
          unitCostPaise: cost.unitCostPaise,
          effectiveFrom: cost.effectiveFrom,
          effectiveTo: cost.effectiveTo,
          source: "financial_scenario_fixture",
          createdBy: input.adminId,
          createdAt: SEEDED_AT,
        }).onConflictDoUpdate({
          target: [productCostVersionsTable.storeProductId, productCostVersionsTable.effectiveFrom],
          set: { unitCostPaise: cost.unitCostPaise, effectiveTo: cost.effectiveTo, source: "financial_scenario_fixture" },
        });
      }
    }
    const costs = await tx.select().from(productCostVersionsTable)
      .where(inArray(productCostVersionsTable.storeId, stores)).orderBy(asc(productCostVersionsTable.effectiveFrom));

    const [coupon] = await tx.insert(promotionsTable).values({
      code: "PIZZA50",
      kind: "coupon",
      name: "Pizza loyalty reward",
      description: "Save 50 rupees on an order of 400 rupees or more",
      scope: "cart",
      discountType: "fixed_amount",
      discountAmountPaise: 5_000,
      minimumOrderPaise: 40_000,
      startsAt: new Date(moveDate("2026-07-01T00:00:00.000Z")),
      endsAt: new Date(moveDate("2026-08-31T23:59:59.000Z")),
      isActive: true,
      maxRedemptions: 1,
      createdAt: SEEDED_AT,
      updatedAt: SEEDED_AT,
    }).returning();

    const orderIds: Record<number, number> = {};
    const orderSnapshots = new Map<number, typeof ordersTable.$inferSelect>();
    const paymentAttemptIds: Record<number, number> = {};
    const orderItemIds = new Map<string, number>();
    const orderItemCostVersionIds = new Map<string, number>();
    const orderItemTaxRates = new Map<string, number>();
    for (const fixture of FIXTURE_ORDERS) {
      const storeId = stores[fixture.storeId - 1];
      const itemRule = rules.find((rule) => rule.storeId === storeId && rule.component === "item")!;
      const deliveryRule = rules.find((rule) => rule.storeId === storeId && rule.component === "delivery")!;
      const pricingRule = deliveryRules.find((rule) => rule.storeId === storeId)!;
      const paymentTime = new Date(fixture.placedAt);
      const [payment] = await tx.insert(paymentsTable).values({
        provider: fixture.paymentMethod === "cod" ? "cod" : "razorpay",
        status: fixture.paymentStatus,
        providerStatus: fixture.paymentStatus === "completed" || fixture.paymentStatus === "refunded" ? "captured" : "failed",
        amountPaise: fixture.grandTotalPaise,
        currency: "INR",
        providerOrderId: fixture.paymentMethod === "razorpay" ? `order_fixture_${fixture.id}` : null,
        providerPaymentId: fixture.paymentMethod === "razorpay" && fixture.paymentStatus !== "failed" ? `pay_fixture_order_${fixture.id}` : null,
        clientRequestId: `demo-payment-${fixture.id}`,
        failureCode: fixture.paymentStatus === "failed" ? "DEMO_PAYMENT_DECLINED" : null,
        failureDescription: fixture.paymentStatus === "failed" ? "Deterministic failed payment attempt" : null,
        paidAt: fixture.paymentStatus === "failed" ? null : paymentTime,
        failedAt: fixture.paymentStatus === "failed" ? paymentTime : null,
        paymentDate: fixture.paymentStatus === "failed" ? null : paymentTime,
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      }).returning();
      const { taxableAmountPaise: deliveryTaxable, taxPaise: deliveryTax } = calculateInclusiveTax(fixture.deliveryFeePaise, deliveryRule.rateBps);
      const deliveredAt = fixture.status === "delivered" ? new Date(fixture.placedAt) : null;
      const [order] = await tx.insert(ordersTable).values({
        userId: input.customers[fixture.id % input.customers.length].id,
        addressId: input.customers[fixture.id % input.customers.length].addresses[fixture.storeId - 1],
        orderDate: new Date(fixture.placedAt),
        discountMode: fixture.couponCode ? "coupon" : "none",
        itemsSubtotalPaise: fixture.itemsSubtotalPaise,
        discountPaise: fixture.discountPaise,
        deliveryFeePaise: fixture.deliveryFeePaise,
        taxableAmountPaise: fixture.taxableAmountPaise,
        taxPaise: fixture.taxPaise,
        roundingAdjustmentPaise: fixture.roundingAdjustmentPaise,
        grandTotalPaise: fixture.grandTotalPaise,
        currency: "INR",
        quoteVersion: `finance-fixture:${fixture.orderNumber}`,
        pricingPolicyVersion: PRICING_POLICY_VERSION,
        deliveryPricingRuleId: pricingRule.id,
        deliveryPricingRuleVersion: pricingRule.version,
        pricingBusinessDate: fixture.businessDate,
        pricingTimezone: "Asia/Kolkata",
        taxCalculationPolicyVersion: 1,
        taxDisclaimer: itemRule.disclaimer,
        taxIsDemo: true,
        placeOfSupplyState: fixture.storeId === 1 ? "Maharashtra" : "Karnataka",
        deliveryTaxRuleId: deliveryRule.id,
        deliveryTaxRuleVersion: deliveryRule.version,
        deliveryTaxRateBps: deliveryRule.rateBps,
        deliveryTaxableAmountPaise: deliveryTaxable,
        deliveryTaxPaise: deliveryTax,
        deliveryHsnSacCode: deliveryRule.hsnSacCode,
        recognizedAt: deliveredAt,
        deliveredAt,
        cancelledAt: fixture.status === "cancelled" ? paymentTime : null,
        status: fixture.status,
        paymentType: fixture.paymentMethod === "cod" ? "cash" : "razorpay",
        paymentId: payment.id,
        storeId,
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      }).returning();
      orderIds[fixture.id] = order.id;
      orderSnapshots.set(fixture.id, order);

      for (let index = 0; index < fixture.items.length; index += 1) {
        const item = fixture.items[index];
        const productId = productIdByFixtureId.get(item.productId)!;
        const storeProduct = storeProductByKey.get(`${storeId}:${productId}`)!;
        const applicableCosts = costs.filter((cost) => cost.storeProductId === storeProduct.id && cost.effectiveFrom <= fixture.businessDate && (!cost.effectiveTo || cost.effectiveTo >= fixture.businessDate));
        const costVersion = applicableCosts.at(-1)!;
        const [saved] = await tx.insert(orderItemsTable).values({
          orderId: order.id,
          productId,
          quantity: item.quantity,
          productName: item.productName + (item.customizationName ? ` + ${item.customizationName}` : ""),
          unitPricePaise: Math.trunc(item.lineSubtotalPaise / item.quantity),
          lineSubtotalPaise: item.lineSubtotalPaise,
          discountAllocationPaise: item.discountAllocationPaise,
          taxRuleId: itemRule.id,
          taxRuleVersion: itemRule.version,
          taxRateBps: itemRule.rateBps,
          taxableAmountPaise: item.taxableAmountPaise,
          taxPaise: item.taxPaise,
          lineTotalPaise: item.lineTotalPaise,
          unitCostPaise: fixture.status === "delivered" ? Math.trunc(item.totalCostPaise / item.quantity) : null,
          lineCostPaise: fixture.status === "delivered" ? item.totalCostPaise : null,
          costVersionId: fixture.status === "delivered" ? costVersion.id : null,
          hsnSacCode: itemRule.hsnSacCode,
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
        }).returning();
        if (item.customizationName) {
          const [option] = await tx.select().from(schema.customizationOptionsTable).where(eq(schema.customizationOptionsTable.name, item.customizationName)).limit(1);
          if (!option) throw new Error("Missing customization option: " + item.customizationName);
          await tx.insert(schema.orderItemCustomizationsTable).values({ orderItemId: saved.id, customizationOptionId: option.id, customizationName: option.name, pricePaise: item.customizationPricePaise ?? 0 });
        }
        orderItemIds.set(`${fixture.id}:${index}`, saved.id);
        orderItemCostVersionIds.set(`${fixture.id}:${index}`, costVersion.id);
        orderItemTaxRates.set(`${fixture.id}:${index}`, saved.taxRateBps);
      }

      if (fixture.couponCode) {
        const [application] = await tx.insert(promotionApplicationsTable).values({
          promotionId: coupon.id, orderId: order.id, userId: order.userId, storeId,
          promotionKind: coupon.kind, promotionName: coupon.name, promotionCode: coupon.code,
          discountType: coupon.discountType, definitionVersion: coupon.definitionVersion,
          status: "consumed", reservedAt: paymentTime, consumedAt: paymentTime,
          itemDiscountPaise: fixture.discountPaise, deliveryDiscountPaise: 0,
          totalSavingsPaise: fixture.discountPaise,
          standardDeliveryFeePaise: fixture.deliveryFeePaise, chargedDeliveryFeePaise: fixture.deliveryFeePaise,
          createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
        }).returning();
        await tx.insert(promotionDiscountAllocationsTable).values(fixture.items.flatMap((item, index) =>
          item.discountAllocationPaise ? [{
            promotionApplicationId: application.id, orderItemId: orderItemIds.get(`${fixture.id}:${index}`)!,
            component: "item" as const, unitIndex: 0, amountPaise: item.discountAllocationPaise, createdAt: SEEDED_AT,
          }] : []));
      }

      const captured = fixture.paymentStatus !== "failed";
      const [attempt] = await tx.insert(paymentAttemptsTable).values({
        orderId: order.id,
        storeId,
        provider: fixture.paymentMethod === "cod" ? "cod" : "razorpay",
        method: fixture.paymentMethod === "cod" ? "cash" : "upi",
        status: captured ? "captured" : "failed",
        providerStatus: captured ? "captured" : "failed",
        amountPaise: fixture.grandTotalPaise,
        currency: "INR",
        providerOrderId: fixture.paymentMethod === "razorpay" ? `order_fixture_${fixture.id}` : null,
        providerPaymentId: fixture.paymentMethod === "razorpay" && captured ? `pay_fixture_order_${fixture.id}` : null,
        clientRequestId: `demo-attempt-${fixture.id}`,
        failureCode: captured ? null : "DEMO_PAYMENT_DECLINED",
        failureDescription: captured ? null : "Deterministic failed payment attempt",
        capturedAt: captured ? paymentTime : null,
        failedAt: captured ? null : paymentTime,
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      }).returning();
      paymentAttemptIds[fixture.id] = attempt.id;
    }

    const cashSessionByOrder = new Map<number, number>();
    let varianceCashSessionId = 0;
    for (const cashOrder of FIXTURE_ORDERS.filter((order) => order.paymentMethod === "cod")) {
      const cashStoreId = stores[cashOrder.storeId - 1];
      const hasVariance = cashOrder.id === 102;
      const openingFloatPaise = 10_000;
      const expectedCashPaise = openingFloatPaise + cashOrder.grandTotalPaise;
      const countedCashPaise = expectedCashPaise - (hasVariance ? 1_000 : 0);
      const [cashSession] = await tx.insert(cashSessionsTable).values({
        storeId: cashStoreId,
        businessDate: cashOrder.businessDate,
        status: "closed",
        currency: "INR",
        openingFloatPaise,
        expectedCashPaise,
        countedCashPaise,
        variancePaise: countedCashPaise - expectedCashPaise,
        materialVarianceAcknowledged: false,
        version: 2,
        openedBy: input.adminId,
        openedAt: isoDateTime(cashOrder.businessDate, 4),
        closedBy: input.adminId,
        closedAt: isoDateTime(cashOrder.businessDate, 22),
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      }).returning();
      cashSessionByOrder.set(cashOrder.id, cashSession.id);
      if (hasVariance) varianceCashSessionId = cashSession.id;
      await tx.insert(cashMovementsTable).values({
        sessionId: cashSession.id,
        storeId: cashStoreId,
        type: "cod_collection",
        amountPaise: cashOrder.grandTotalPaise,
        orderId: orderIds[cashOrder.id],
        recordedBy: input.adminId,
        occurredAt: isoDateTime(cashOrder.businessDate, 19),
        createdAt: SEEDED_AT,
      });
      await tx.insert(cashSessionClosuresTable).values({
        sessionId: cashSession.id,
        storeId: cashStoreId,
        sessionVersion: 2,
        expectedCashPaise,
        countedCashPaise,
        variancePaise: countedCashPaise - expectedCashPaise,
        materialVarianceAcknowledged: false,
        closedBy: input.adminId,
        closedAt: isoDateTime(cashOrder.businessDate, 22),
        createdAt: SEEDED_AT,
      });
    }

    let journalCount = 0;
    for (const fixture of FIXTURE_ORDERS) {
      const storeId = stores[fixture.storeId - 1];
      if (fixture.paymentStatus === "failed") {
        await seedEvent(tx, eventInput({ eventType: "payment_attempt.failed", sourceType: "payment_attempt", sourceId: paymentAttemptIds[fixture.id], storeId, businessDate: fixture.businessDate, occurredAt: new Date(fixture.placedAt), actorId: input.adminId, payload: { paymentAttemptId: paymentAttemptIds[fixture.id], orderId: orderIds[fixture.id], failureCode: "DEMO_PAYMENT_DECLINED" } }));
        continue;
      }
      const capture = eventInput({ eventType: "payment_attempt.captured", sourceType: "payment_attempt", sourceId: paymentAttemptIds[fixture.id], storeId, businessDate: fixture.businessDate, occurredAt: new Date(fixture.placedAt), actorId: input.adminId, payload: { paymentAttemptId: paymentAttemptIds[fixture.id], orderId: orderIds[fixture.id], provider: fixture.paymentMethod === "cod" ? "cod" : "razorpay", method: fixture.paymentMethod === "cod" ? "cash" : "upi", capturedPaise: fixture.grandTotalPaise, capturedAt: fixture.placedAt, providerReference: fixture.paymentMethod === "razorpay" ? `pay_fixture_order_${fixture.id}` : null, cashSessionId: fixture.paymentMethod === "cod" ? cashSessionByOrder.get(fixture.id) : null } });
      if (await seedEvent(tx, capture, buildCapturedPaymentPosting(asEvent(capture)))) journalCount += 1;
      if (fixture.status !== "delivered") continue;
      const lineCostSnapshots = fixture.items.map((item, index) => ({
        orderItemId: orderItemIds.get(`${fixture.id}:${index}`)!,
        productId: productIdByFixtureId.get(item.productId)!,
        quantity: item.quantity,
        costVersionId: orderItemCostVersionIds.get(`${fixture.id}:${index}`)!,
        unitCostPaise: Math.trunc(item.totalCostPaise / item.quantity),
        lineCostPaise: item.totalCostPaise,
        lineSubtotalPaise: item.lineSubtotalPaise,
        discountAllocationPaise: item.discountAllocationPaise,
        taxableAmountPaise: item.taxableAmountPaise,
        taxPaise: item.taxPaise,
        taxRateBps: orderItemTaxRates.get(`${fixture.id}:${index}`)!,
      }));
      const deliveredAt = new Date(fixture.placedAt);
      const delivery = eventInput({
        eventType: "order.delivered", sourceType: "order", sourceId: orderIds[fixture.id],
        storeId, businessDate: fixture.businessDate, occurredAt: deliveredAt, actorId: input.adminId,
        payload: buildDeliveredOrderPayload(orderSnapshots.get(fixture.id)!, lineCostSnapshots, deliveredAt),
      });
      if (await seedEvent(tx, delivery, buildDeliveredOrderPosting(asEvent(delivery)))) journalCount += 1;
    }

    const refundedOrder = FIXTURE_ORDERS.find((order) => order.refundPaise)!;
    const refundedStoreId = stores[refundedOrder.storeId - 1];
    const refundTime = new Date(moveDate("2026-07-23T08:00:00.000Z"));
    const refundItemId = orderItemIds.get(`${refundedOrder.id}:0`)!;
    const [refund] = await tx.insert(refundsTable).values({
      orderId: orderIds[refundedOrder.id], paymentAttemptId: paymentAttemptIds[refundedOrder.id], storeId: refundedStoreId,
      amountPaise: refundedOrder.refundPaise!, currency: "INR", status: "processed", reasonCode: "DAMAGED_ITEM", reasonNote: refundedOrder.refundReason,
      clientRequestId: `demo-refund-${refundedOrder.id}`, providerRefundId: `rfnd_fixture_order_${refundedOrder.id}`, providerStatus: "processed", version: 4,
      requestedBy: input.financeId, approvedBy: input.adminId, submittedBy: input.adminId, processedBy: input.adminId,
      requestedAt: refundTime, approvedAt: refundTime, submittedAt: refundTime, processedAt: refundTime, createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
    }).returning();
    const [refundAllocation] = await tx.insert(refundAllocationsTable).values({
      refundId: refund.id, orderId: orderIds[refundedOrder.id], kind: "item", orderItemId: refundItemId, quantity: 1,
      amountPaise: refundedOrder.refundPaise!, taxableAmountPaise: 38_095, taxPaise: 1_905, discountReversalPaise: 0, createdAt: SEEDED_AT,
    }).returning();
    const processedRefund = eventInput({ eventType: "refund.processed", sourceType: "refund", sourceId: refund.id, sourceVersion: 4, storeId: refundedStoreId, businessDate: moveDate("2026-07-23"), occurredAt: refundTime, actorId: input.adminId, payload: { refundId: refund.id, orderId: orderIds[refundedOrder.id], paymentAttemptId: paymentAttemptIds[refundedOrder.id], totalPaise: refundedOrder.refundPaise!, provider: "razorpay", providerReference: `rfnd_fixture_order_${refundedOrder.id}`, processedAt: refundTime.toISOString(), fulfilmentState: "delivered", recognizedAt: refundedOrder.placedAt, allocations: [{ kind: "item", orderItemId: refundItemId, quantity: 1, amountPaise: refundAllocation.amountPaise, taxableAmountPaise: refundAllocation.taxableAmountPaise, taxPaise: refundAllocation.taxPaise, discountReversalPaise: 0 }] } });
    if (await seedEvent(tx, processedRefund, buildProcessedRefundPosting(asEvent(processedRefund)))) journalCount += 1;
    const disbursedRefund = eventInput({ eventType: "refund.disbursed", sourceType: "refund", sourceId: refund.id, sourceVersion: 5, storeId: refundedStoreId, businessDate: moveDate("2026-07-23"), occurredAt: refundTime, actorId: input.adminId, payload: { refundId: refund.id, orderId: orderIds[refundedOrder.id], method: "razorpay", disbursedPaise: refundedOrder.refundPaise!, clearingReference: `rfnd_fixture_order_${refundedOrder.id}`, disbursedAt: refundTime.toISOString() } });
    if (await seedEvent(tx, disbursedRefund, buildDisbursedRefundPosting(asEvent(disbursedRefund)))) journalCount += 1;

    const settlementIds: Record<string, number> = {};
    for (const fixture of FIXTURE_SETTLEMENTS) {
      const storeId = stores[fixture.storeId - 1];
      const [batch] = await tx.insert(settlementBatchesTable).values({
        storeId, provider: "razorpay", providerSettlementId: fixture.id, providerStatus: "processed", status: "reconciled", source: "fixture",
        periodFrom: isoDateTime(fixture.businessDate, 0), periodTo: new Date(fixture.settledAt), grossAmountPaise: fixture.grossAmountPaise,
        feePaise: fixture.gatewayFeePaise, feeTaxPaise: fixture.gatewayTaxPaise, adjustmentPaise: -fixture.refundsDeductedPaise,
        netAmountPaise: fixture.netPayoutPaise, currency: "INR", utr: `UTR-${fixture.id}`, providerReference: `fixture-${fixture.id}`,
        payloadHash: HASH, settledAt: new Date(fixture.settledAt), importedBy: input.adminId, importedAt: new Date(fixture.settledAt), reconciledAt: new Date(fixture.settledAt), createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
      }).returning();
      settlementIds[fixture.id] = batch.id;
      const lineMatches: Array<{ settlementLineId: number; matchStatus: "matched"; paymentAttemptId: number | null; refundId: number | null }> = [];
      for (const orderFixtureId of fixture.matchedOrderIds) {
        const [line] = await tx.insert(settlementLinesTable).values({
          batchId: batch.id, storeId, providerLineId: `line:${fixture.id}:payment:${orderFixtureId}`, providerTransactionId: `pay_fixture_order_${orderFixtureId}`,
          providerEntityId: `pay_fixture_order_${orderFixtureId}`, type: "payment", providerStatus: "captured",
          amountPaise: FIXTURE_ORDERS.find((order) => order.id === orderFixtureId)!.grandTotalPaise, currency: "INR", occurredAt: new Date(FIXTURE_ORDERS.find((order) => order.id === orderFixtureId)!.placedAt),
          matchStatus: "matched", paymentAttemptId: paymentAttemptIds[orderFixtureId], payloadHash: HASH, createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
        }).returning();
        lineMatches.push({ settlementLineId: line.id, matchStatus: "matched", paymentAttemptId: paymentAttemptIds[orderFixtureId], refundId: null });
      }
      if (fixture.refundsDeductedPaise) {
        const [line] = await tx.insert(settlementLinesTable).values({
          batchId: batch.id, storeId, providerLineId: `line:${fixture.id}:refund:${refund.id}`, providerTransactionId: `rfnd_fixture_order_${refundedOrder.id}`,
          providerEntityId: `rfnd_fixture_order_${refundedOrder.id}`, type: "refund", providerStatus: "processed", amountPaise: -fixture.refundsDeductedPaise,
          currency: "INR", occurredAt: refundTime, matchStatus: "matched", refundId: refund.id, payloadHash: HASH, createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
        }).returning();
        lineMatches.push({ settlementLineId: line.id, matchStatus: "matched", paymentAttemptId: null, refundId: refund.id });
      }
      const settlementEvent = eventInput({ eventType: "settlement.reconciled", sourceType: "settlement_batch", sourceId: batch.id, storeId, businessDate: fixture.businessDate, occurredAt: new Date(fixture.settledAt), actorId: input.adminId, payload: { batchId: batch.id, providerSettlementId: fixture.id, grossAmountPaise: fixture.grossAmountPaise, netAmountPaise: fixture.netPayoutPaise, feePaise: fixture.gatewayFeePaise, feeTaxPaise: fixture.gatewayTaxPaise, adjustmentPaise: -fixture.refundsDeductedPaise, refundDeductionPaise: fixture.refundsDeductedPaise, adjustments: [], lineMatches, utr: `UTR-${fixture.id}`, providerReference: `fixture-${fixture.id}`, settledAt: fixture.settledAt } });
      if (await seedEvent(tx, settlementEvent, buildSettlementPosting(asEvent(settlementEvent)))) journalCount += 1;
    }

    const cashOrder = FIXTURE_ORDERS.find((order) => order.id === 102)!;
    const cashStoreId = stores[cashOrder.storeId - 1];
    const closureEvent = eventInput({ eventType: "cash.session_closed", sourceType: "cash_session", sourceId: varianceCashSessionId, sourceVersion: 2, storeId: cashStoreId, businessDate: cashOrder.businessDate, occurredAt: isoDateTime(cashOrder.businessDate, 22), actorId: input.adminId, payload: { sessionId: varianceCashSessionId, variancePaise: -1_000, closedAt: isoDateTime(cashOrder.businessDate, 22).toISOString() } });
    if (await seedEvent(tx, closureEvent, buildCashClosurePosting(asEvent(closureEvent)))) journalCount += 1;

    const operatingAccount = (await tx.select().from(ledgerAccountsTable).where(eq(ledgerAccountsTable.code, "6900")))[0];
    const categoryNames = [...new Set(FIXTURE_EXPENSES.map((expense) => expense.category))];
    const categories = await tx.insert(expenseCategoriesTable).values(categoryNames.map((name) => ({ storeId: null, name, normalizedName: name.toLowerCase(), classification: name === "Rent" ? "fixed" as const : "variable" as const, ledgerAccountId: operatingAccount.id, createdBy: input.adminId, updatedBy: input.adminId, createdAt: SEEDED_AT, updatedAt: SEEDED_AT }))).returning();
    const categoryByName = new Map(categories.map((category) => [category.name, category]));
    const expenseIds: Record<number, number> = {};
    for (const fixture of FIXTURE_EXPENSES) {
      const storeId = stores[fixture.storeId - 1];
      const time = isoDateTime(fixture.businessDate, 10);
      const [expense] = await tx.insert(expensesTable).values({
        storeId, vendorName: fixture.category === "Rent" ? "Harbour Properties" : fixture.category === "Utilities" ? "City Energy Services" : fixture.category === "Cleaning" ? "Sparkle Facility Services" : "FreshFold Packaging", expenseDate: fixture.businessDate, description: `${fixture.category} — ${fixture.storeId === 1 ? "Fort" : "Koramangala"} — ${fixture.businessDate.slice(0, 7)}`,
        subtotalPaise: fixture.amountPaise, taxPaise: fixture.taxPaise, totalPaise: fixture.amountPaise + fixture.taxPaise, currency: "INR", status: "posted",
        paymentMethod: fixture.paymentMethod === "petty_cash" ? "cash" : "bank_transfer", paymentReference: `DEMO-EXP-${fixture.id}`,
        clientRequestId: `demo-expense-${fixture.id}`, payloadHash: HASH, version: 5, createdBy: input.adminId, updatedBy: input.adminId,
        submittedBy: input.financeId, submittedAt: time, approvedBy: input.adminId, approvedAt: time, paidBy: input.adminId, paidAt: time, postedBy: input.adminId, postedAt: time,
        createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
      }).returning();
      expenseIds[fixture.id] = expense.id;
      const category = categoryByName.get(fixture.category)!;
      const [allocation] = await tx.insert(expenseAllocationsTable).values({
        expenseId: expense.id, expenseStoreId: storeId, storeId, categoryId: category.id, categoryName: category.name,
        categoryClassification: category.classification, ledgerAccountId: operatingAccount.id, costCenter: `STORE-${fixture.storeId}`,
        amountPaise: expense.totalPaise, createdAt: SEEDED_AT,
      }).returning();
      const expenseEvent = eventInput({ eventType: "expense.posted", sourceType: "expense", sourceId: expense.id, sourceVersion: 5, storeId, businessDate: fixture.businessDate, occurredAt: time, actorId: input.adminId, payload: { expenseId: expense.id, totalPaise: expense.totalPaise, paymentMethod: expense.paymentMethod, paymentReference: expense.paymentReference, paidAt: time.toISOString(), postedAt: time.toISOString(), allocations: [{ storeId, categoryId: category.id, ledgerAccountId: operatingAccount.id, ledgerAccountCode: "6900", costCenter: allocation.costCenter, amountPaise: allocation.amountPaise }] } });
      if (await seedEvent(tx, expenseEvent, buildExpensePosting(asEvent(expenseEvent)))) journalCount += 1;
    }

    const profileByFixtureId = new Map<number, { id: number; storeId: number }>();
    const compensationByKey = new Map<string, { id: number; componentId: number }>();
    for (const employee of FIXTURE_EMPLOYEES) {
      const storeId = stores[employee.storeId - 1];
      const [profile] = await tx.insert(employeeFinanceProfilesTable).values({ storeId, employeeCode: `DEMO-${employee.id}`, displayName: employee.name, employmentStartDate: moveDate("2026-01-01"), status: "active", payFrequency: "monthly", createdBy: input.adminId, updatedBy: input.adminId, createdAt: SEEDED_AT, updatedAt: SEEDED_AT }).returning();
      profileByFixtureId.set(employee.id, profile);
      const versions = employee.monthlySalaryMonth1Paise === employee.monthlySalaryMonth2Paise
        ? [{ key: moveDate("2026-07"), from: moveDate("2026-01-01"), to: null, amount: employee.monthlySalaryMonth1Paise, note: "Deterministic fixture compensation" }]
        : [{ key: moveDate("2026-07"), from: moveDate("2026-01-01"), to: moveDate("2026-07-31"), amount: employee.monthlySalaryMonth1Paise, note: "Deterministic fixture compensation" }, { key: moveDate("2026-08"), from: moveDate("2026-08-01"), to: null, amount: employee.monthlySalaryMonth2Paise, note: "Merit compensation change" }];
      for (const version of versions) {
        const [compensation] = await tx.insert(compensationVersionsTable).values({ profileId: profile.id, storeId, effectiveFrom: version.from, effectiveTo: version.to, currency: "INR", sourceNote: version.note, demoOnly: true, createdBy: input.adminId, createdAt: SEEDED_AT }).returning();
        const [component] = await tx.insert(compensationComponentsTable).values({ compensationVersionId: compensation.id, type: "earning", code: "BASE", name: "Base salary", amountPaise: version.amount, createdAt: SEEDED_AT }).returning();
        compensationByKey.set(`${employee.id}:${version.key}`, { id: compensation.id, componentId: component.id });
        if (version.key === moveDate("2026-07") && versions.length === 1) compensationByKey.set(`${employee.id}:${moveDate("2026-08")}`, { id: compensation.id, componentId: component.id });
      }
    }

    const payRunIds: Record<number, number> = {};
    for (const fixture of FIXTURE_PAY_RUNS) {
      const storeId = stores[fixture.storeId - 1];
      const periodStart = `${fixture.month}-01`;
      const periodEnd = monthEnd(fixture.month);
      const time = isoDateTime(fixture.businessDate, 16);
      const [run] = await tx.insert(payRunsTable).values({
        storeId, periodStart, periodEnd, status: "posted", currency: "INR", demoOnly: true, employeeCount: fixture.employeeIds.length,
        grossPayPaise: fixture.totalGrossPayPaise, deductionPaise: fixture.totalDeductionsPaise, netPayPaise: fixture.totalNetPayPaise,
        employerCostPaise: 0, totalEmployerCostPaise: fixture.totalGrossPayPaise,
        clientRequestId: `00000000-0000-4000-8000-${String(fixture.id).padStart(12, "0")}`, payloadHash: HASH, version: 5,
        createdBy: input.adminId, calculatedBy: input.adminId, calculatedAt: time, approvedBy: input.adminId, approvedAt: time,
        paidBy: input.adminId, paidAt: time, paymentReference: `DEMO-PAYRUN-${fixture.id}`, postedBy: input.adminId, postedAt: time,
        createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
      }).returning();
      payRunIds[fixture.id] = run.id;
      for (const employeeId of fixture.employeeIds) {
        const employee = FIXTURE_EMPLOYEES.find((candidate) => candidate.id === employeeId)!;
        const compensation = compensationByKey.get(`${employeeId}:${fixture.month}`)!;
        const amount = fixture.month === moveDate("2026-07") ? employee.monthlySalaryMonth1Paise : employee.monthlySalaryMonth2Paise;
        const profile = profileByFixtureId.get(employeeId)!;
        const [runEmployee] = await tx.insert(payRunEmployeesTable).values({ payRunId: run.id, payRunStoreId: storeId, profileId: profile.id, compensationVersionId: compensation.id, employeeCode: `DEMO-${employee.id}`, displayName: employee.name, grossPayPaise: amount, deductionPaise: 0, netPayPaise: amount, employerCostPaise: 0, totalEmployerCostPaise: amount, createdAt: SEEDED_AT }).returning();
        await tx.insert(payRunLinesTable).values({ payRunEmployeeId: runEmployee.id, compensationComponentId: compensation.componentId, type: "earning", componentCode: "BASE", componentName: "Base salary", amountPaise: amount, createdAt: SEEDED_AT });
      }
      const payRunEvent = eventInput({ eventType: "pay_run.posted", sourceType: "pay_run", sourceId: run.id, sourceVersion: 5, storeId, businessDate: fixture.businessDate, occurredAt: time, actorId: input.adminId, payload: { payRunId: run.id, periodStart, periodEnd, grossPayPaise: fixture.totalGrossPayPaise, deductionPaise: fixture.totalDeductionsPaise, netPayPaise: fixture.totalNetPayPaise, employerCostPaise: 0, totalEmployerCostPaise: fixture.totalGrossPayPaise, paymentReferenceRecorded: true, postedAt: time.toISOString() } });
      if (await seedEvent(tx, payRunEvent, buildPayRunPosting(asEvent(payRunEvent)))) journalCount += 1;
    }

    for (const storeId of stores) {
      await tx.insert(fiscalPeriodsTable).values([
        { storeId, name: moveDate("2026-07"), startDate: moveDate("2026-07-01"), endDate: moveDate("2026-07-31"), status: "closed", softClosedBy: input.adminId, softClosedAt: SEEDED_AT, closedBy: input.adminId, closedAt: SEEDED_AT, createdAt: SEEDED_AT, updatedAt: SEEDED_AT },
        { storeId, name: moveDate("2026-08"), startDate: moveDate("2026-08-01"), endDate: moveDate("2026-08-31"), status: "open", createdAt: SEEDED_AT, updatedAt: SEEDED_AT },
      ]);
    }

    return { reportingPeriods: [moveDate("2026-07"), moveDate("2026-08")], orderIds, paymentAttemptIds, refundId: refund.id, settlementIds, cashSessionId: varianceCashSessionId, expenseIds, payRunIds, journalCount };
}

export async function seedShowcase(tx: TransactionType, plan: RecruiterPlan, newFiles: string[], adminEmail?: string, assetRoot = BACKEND_ROOT) {
  const admins = await tx.select().from(schema.usersTable).where(eq(schema.usersTable.role, "admin"));
  const admin = adminEmail ? admins.find(user => user.email.toLowerCase() === adminEmail.toLowerCase()) : admins.length === 1 ? admins[0] : undefined;
  if (!admin?.isActive) throw new Error("An active existing admin is required. If several exist, pass --admin=your-email.");
  const existing = await tx.select().from(schema.auditLogsTable).where(eq(schema.auditLogsTable.action, COMPLETION_ACTION)).limit(1);
  if (existing.length) return { alreadySeeded: true, ...existing[0].metadata };
  for (const table of Object.values(schema).filter(value => is(value, PgTable))) {
    if (table === schema.usersTable || table === schema.ledgerAccountsTable || table === schema.auditLogsTable) continue;
    if ((await tx.select().from(table).limit(1)).length) throw new Error(`${getTableName(table)} contains data. This seed requires the cleared demo database; nothing was changed.`);
  }
  if ((await tx.select().from(schema.usersTable).where(eq(schema.usersTable.role, "user")).limit(1)).length) throw new Error("Customer/staff data already exists; nothing was changed.");
  const passwordHash = await bcrypt.hash(process.env.RECRUITER_DEMO_PASSWORD ?? PASSWORD, 12);
  const { faker } = await import("@faker-js/faker");
  faker.seed(20261010);
  const stores = await tx.insert(schema.storesTable).values([
    { name: "PizzaStore - Fort", slug: "recruiter-fort", address: "18, Homi Modi Street, Fort", city: "Mumbai", state: "Maharashtra", pincode: "400001", phone: "02240001001", email: "fort@pizzastore.example", latitude: 18.9345, longitude: 72.8333, opensAt: "09:00", closesAt: "23:00", timezone: "Asia/Kolkata" },
    { name: "PizzaStore - Koramangala", slug: "recruiter-koramangala", address: "42, 80 Feet Road, Koramangala", city: "Bengaluru", state: "Karnataka", pincode: "560034", phone: "08040001002", email: "koramangala@pizzastore.example", latitude: 12.9352, longitude: 77.6245, opensAt: "09:00", closesAt: "23:00", timezone: "Asia/Kolkata" },
  ]).returning();
  const staff: Array<typeof schema.usersTable.$inferSelect> = [];
  for (const [index, role] of (["manager", "finance_manager", "payroll_manager", "operator", "inventory_staff"] as const).entries()) {
    const [user] = await tx.insert(schema.usersTable).values({ fname: ["Aarav", "Meera", "Ananya", "Rohan", "Kabir"][index], lname: ["Shah", "Iyer", "Rao", "Desai", "Patel"][index], email: `${role}@recruiter.pizzastore.test`, password: passwordHash }).returning();
    staff.push(user);
    await tx.insert(schema.storeMembershipsTable).values(stores.map(store => ({ userId: user.id, storeId: store.id, role, createdBy: admin.id, updatedBy: admin.id })));
  }
  const customers: Array<{ id: number; addresses: number[] }> = [];
  for (let index = 0; index <= plan.customers; index++) {
    const [customer] = await tx.insert(schema.usersTable).values({ fname: index === 0 ? "Shreyas" : faker.person.firstName(), lname: index === 0 ? "Kulkarni" : faker.person.lastName(), email: index === plan.customers ? "new.customer@recruiter.pizzastore.test" : index === 0 ? "customer@recruiter.pizzastore.test" : `customer${index + 1}@recruiter.pizzastore.test`, password: passwordHash }).returning();
    const addresses = await tx.insert(schema.addressTable).values(stores.map((store, storeIndex) => ({ userId: customer.id, type: storeIndex === 0 ? "Home" as const : "Work" as const, street: `${index + 11}, ${storeIndex === 0 ? "Rosewood Apartments, Homi Modi Street" : "Maple Residency, 5th Block"}`, city: store.city, state: store.state, pincode: store.pincode, phone: `90000${String(index).padStart(5, "0")}` }))).returning();
    if (index < plan.customers) customers.push({ id: customer.id, addresses: addresses.map(address => address.id) });
  }
  for (const store of stores) {
    await tx.insert(schema.deliveryZonesTable).values([store.pincode, ...(store.city === "Mumbai" ? ["400005", "400020"] : ["560095", "560030"])].map(pincode => ({ storeId: store.id, pincode })));
    await tx.insert(schema.deliveryPricingRulesTable).values({ storeId: store.id, version: 1, deliveryFeePaise: 4000, freeDeliveryThresholdPaise: 50000, effectiveFrom: "2000-01-01" });
    await tx.insert(schema.taxRulesTable).values((["item", "delivery"] as const).map(component => ({ storeId: store.id, component, version: 1, rateBps: 500, hsnSacCode: component === "item" ? "21069099-DEMO" : "996331-DEMO", effectiveFrom: "2000-01-01" })));
  }
  const categories = await tx.insert(schema.categoriesTable).values(categoryData).returning();
  const products = await tx.insert(productsTable).values(productData.map(({ category, ...product }) => ({ ...product, categoryId: categories.find(row => row.name === category)!.id }))).returning();
  const options = [];
  for (const { options: optionValues, ...values } of customizationData) {
    const [group] = await tx.insert(schema.customizationGroupsTable).values(values).returning();
    options.push(...await tx.insert(schema.customizationOptionsTable).values(optionValues.map(option => ({ ...option, groupId: group.id }))).returning());
    await tx.insert(schema.productCustomizationGroupMappingTable).values(products.filter(product => product.hasCustomization).map(product => ({ productId: product.id, groupId: group.id })));
  }
  for (const { productSlugs, ...menu } of menuData) {
    const [row] = await tx.insert(schema.menuItemsTable).values(menu).returning();
    await tx.insert(schema.menuItemsMappingTable).values(products.filter(product => productSlugs.includes(product.slug)).map(product => ({ menuItemId: row.id, productId: product.id })));
  }
  for (const store of stores) {
    const mapped = await tx.insert(storeProductsTable).values(products.map(product => ({ storeId: store.id, productId: product.id, pricePaise: product.pricePaise, onHandQuantity: 1000, lowStockThreshold: 10 }))).returning();
    await tx.insert(schema.inventoryMovementsTable).values(mapped.map(row => ({ storeProductId: row.id, changeType: "restock" as const, quantityChange: 1000, previousQuantity: 0, newQuantity: 1000, reason: "Recruiter showcase opening stock", idempotencyKey: `recruiter:opening:${row.id}`, createdBy: staff[4].id, createdAt: new Date(`${shiftReferenceDate("2026-01-01", plan.asOf)}T02:00:00Z`) })));
    const owned = new Set(Object.values(productSlugByFixtureId));
    await tx.insert(productCostVersionsTable).values(mapped.filter(row => !owned.has(products.find(product => product.id === row.productId)!.slug)).map(row => ({ storeProductId: row.id, storeId: store.id, unitCostPaise: Math.round(row.pricePaise * 0.35), effectiveFrom: "2000-01-01", source: "recruiter_demo", createdBy: admin.id })));
  }
  for (const account of SYSTEM_LEDGER_ACCOUNTS) {
    const [existingAccount] = await tx.select().from(ledgerAccountsTable).where(eq(ledgerAccountsTable.code, account.code));
    if (existingAccount && (existingAccount.type !== account.type || existingAccount.normalSide !== account.normalSide || !existingAccount.isActive)) throw new Error(`Ledger account ${account.code} conflicts with the system account.`);
    if (!existingAccount) await tx.insert(ledgerAccountsTable).values({ ...account, currency: "INR", isSystem: true });
  }
  const finance = await seedFinance(tx, { adminId: admin.id, financeId: staff[1].id, customerId: customers[0].id, customers, storeIds: [stores[0].id, stores[1].id] }, plan);
  await seedExtras(tx, plan, { admin, stores, staff, customers, products, options, finance, assetRoot }, newFiles);
  for (const query of [
    sql`select journal_entry_id from journal_lines group by journal_entry_id having sum(debit_paise) <> sum(credit_paise)`,
    sql`select o.id from orders o join order_items i on i.order_id = o.id group by o.id having o.items_subtotal_paise <> sum(i.line_subtotal_paise) or o.discount_paise <> sum(i.discount_allocation_paise) or o.tax_paise <> sum(i.tax_paise) + o.delivery_tax_paise`,
    sql`select sp.id from store_products sp left join inventory_movements im on im.store_product_id = sp.id where sp.on_hand_quantity is not null group by sp.id having sp.on_hand_quantity <> sum(im.quantity_change)`,
  ]) {
    if ((await tx.execute(query)).rows.length) throw new Error("Seed integrity check failed. Orders, inventory and journals must reconcile before commit.");
  }
  const coverage: Record<string, number> = {};
  for (const table of Object.values(schema).filter(value => is(value, PgTable))) {
    const result = await tx.execute(sql`select count(*)::integer as count from ${table}`);
    const count = Number(result.rows[0].count);
    if (!count) throw new Error(`Demo coverage missing: ${getTableName(table)}`);
    coverage[getTableName(table)] = count;
  }
  const summary = { asOf: plan.asOf, stores: stores.map(store => ({ id: store.id, name: store.name })), orders: plan.orders.length + 4, reportingPeriods: finance.reportingPeriods, journals: finance.journalCount, coverage };
  await tx.insert(schema.auditLogsTable).values({ actorUserId: admin.id, actorEmailSnapshot: admin.email, platformRole: "admin", action: COMPLETION_ACTION, resourceType: "recruiter_demo", outcome: "success", metadata: summary });
  return summary;
}

type ExtraContext = {
  assetRoot: string;
  admin: typeof schema.usersTable.$inferSelect;
  stores: Array<typeof schema.storesTable.$inferSelect>;
  staff: Array<typeof schema.usersTable.$inferSelect>;
  customers: Array<{ id: number; addresses: number[] }>;
  products: Array<typeof productsTable.$inferSelect>;
  options: Array<typeof schema.customizationOptionsTable.$inferSelect>;
  finance: DemoScenarioResult;
};

async function seedExtras(tx: TransactionType, plan: RecruiterPlan, context: ExtraContext, newFiles: string[]) {
  const { admin, stores, staff, customers, products, options, finance } = context;
  const today = new Date(`${plan.asOf}T03:30:00Z`);
  for (const name of ["Harbour Properties", "City Energy Services", "Sparkle Facility Services", "FreshFold Packaging"]) {
    const [vendor] = await tx.insert(schema.vendorsTable).values({ name, normalizedName: name.toLowerCase(), createdBy: admin.id, updatedBy: admin.id, paymentTermsDays: 15 }).returning();
    await tx.update(expensesTable).set({ vendorId: vendor.id }).where(eq(expensesTable.vendorName, name));
  }
  const pizza = products.find(product => product.slug === "margherita-pizza")!;
  const drink = products.find(product => product.slug === "coca-cola")!;
  const [bundle] = await tx.insert(productsTable).values({ name: "Pizza and Coke Combo", slug: "recruiter-pizza-coke-combo", description: "A classic Margherita pizza and chilled Coca-Cola, together for less.", image: pizza.image, pricePaise: 32900, categoryId: pizza.categoryId, productType: "bundle", veg: true, hasCustomization: false }).returning();
  await tx.insert(schema.bundleComponentsTable).values([{ bundleProductId: bundle.id, componentProductId: pizza.id, quantity: 1 }, { bundleProductId: bundle.id, componentProductId: drink.id, quantity: 1 }]);
  await tx.insert(storeProductsTable).values(stores.map(store => ({ storeId: store.id, productId: bundle.id, pricePaise: 32900, compareAtPricePaise: 35900, onHandQuantity: null })));
  const [pizzaMenu] = await tx.select().from(schema.menuItemsTable).where(eq(schema.menuItemsTable.slug, "pizzas"));
  await tx.insert(schema.menuItemsMappingTable).values({ menuItemId: pizzaMenu.id, productId: bundle.id });




  const names = ["Classic pizza savings", "Pizza night special", "Buy two, enjoy three", "Delivery on us", "Family feast savings", "Welcome pizza offer", "Your next pizza night", "First order welcome"];
  const codes: Record<string, string> = { DEMO10: "PIZZA10", DEMO30: "PIZZA30", DEMOFIRST: "WELCOME" };
  for (const [index, original] of promotionFixtures({ pizzaId: pizza.id, pizzaCategoryId: pizza.categoryId }).entries()) {
    const definition = { ...original, name: names[index] ?? original.name.replace(/^Demo /, ""), code: original.code ? codes[original.code] ?? original.code : null, validity: { ...original.validity, startsAt: `${shiftReferenceDate("2026-07-01", plan.asOf)}T00:00:00Z`, endsAt: `${Number(plan.asOf.slice(0, 4)) + 2}-12-31T23:59:59Z` } };
    let imageUrl: string | null = null;
    let mobileImageUrl: string | null = null;
    if (definition.display.showOnHomepage) for (const variant of ["desktop", "mobile"] as const) {
      const bytes = await promotionFixtureArtwork(variant, index === 0 ? "percentage" : "fixed_amount");
      const key = `${randomUUID()}.webp`;
      const target = path.resolve(context.assetRoot, PROMOTION_MEDIA_DIRECTORY, key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: "wx" });
      newFiles.push(target);
      if (variant === "desktop") imageUrl = `${PROMOTION_MEDIA_URL_PREFIX}${key}`;
      else mobileImageUrl = `${PROMOTION_MEDIA_URL_PREFIX}${key}`;
    }
    const [promotion] = await tx.insert(promotionsTable).values({ ...definitionToValues(definition), imageUrl, mobileImageUrl, imageAlt: imageUrl ? "Pizza offer. Checkout confirms eligibility." : null }).returning();
    const rules = rulesToValues(promotion.id, definition.rules);
    if (rules.length) await tx.insert(schema.promotionRulesTable).values(rules);
    if (index === 0) await tx.insert(schema.storePromotionSettingsTable).values({ promotionId: promotion.id, storeId: stores[1].id, isEnabled: false, disabledReason: "Local store runs its own pizza night special", updatedByUserId: admin.id });
  }
  for (const [index, customer] of customers.slice(0, 6).entries()) {
    const [cart] = await tx.insert(schema.cartTable).values({ userId: customer.id, storeId: stores[index % 2].id, totalPaise: pizza.pricePaise + 6000 + drink.pricePaise }).returning();
    const [item] = await tx.insert(schema.cartItemsTable).values({ cartId: cart.id, productId: pizza.id, quantity: 1, pricePaise: pizza.pricePaise + 6000 }).returning();
    await tx.insert(schema.cartItemsTable).values({ cartId: cart.id, productId: drink.id, quantity: 1, pricePaise: drink.pricePaise });
    await tx.insert(schema.cartItemCustomizationsTable).values(options.filter(option => ["Regular", "Hand Tossed", "Extra Cheese"].includes(option.name)).map(option => ({ cartItemId: item.id, customizationOptionId: option.id, pricePaise: option.pricePaise })));
    const [session] = await tx.insert(schema.chatSessionsTable).values({ userId: customer.id, subject: ["Delivery instructions", "Family meal recommendation", "Order arrived cold", "Coupon eligibility", "Ingredient information", "Receipt request"][index], status: index < 3 ? "open" : "close" }).returning();
    await tx.insert(schema.chatMessagesTable).values([{ sessionId: session.id, senderId: customer.id, message: "Hi! Could you help me with my pizza order?" }, { sessionId: session.id, senderId: admin.id, message: "Of course. Please share the order number and I will check it for you." }, { sessionId: session.id, senderId: customer.id, message: index < 3 ? "Thank you, I am checking the order details now." : "Thank you for sorting that out!" }]);
  }
  await seedStockHistory(tx, plan, context);
  for (const [index, store] of stores.entries()) {
    await tx.insert(schema.cashSessionsTable).values({ storeId: store.id, businessDate: plan.asOf, openingFloatPaise: 10000, expectedCashPaise: 10000, openedBy: staff[3].id, openedAt: today });
    await tx.insert(schema.fiscalPeriodsTable).values({ storeId: store.id, name: plan.asOf.slice(0, 7), startDate: `${plan.asOf.slice(0, 7)}-01`, endDate: monthEnd(plan.asOf.slice(0, 7)), status: "open" });
    await tx.insert(schema.storeStaffInvitationsTable).values([{ storeId: store.id, email: `join${index}@recruiter.pizzastore.test`, normalizedEmail: `join${index}@recruiter.pizzastore.test`, role: "operator", tokenHash: createHash("sha256").update(randomUUID()).digest("hex"), invitedBy: admin.id, expiresAt: new Date(today.getTime() + 7 * 86400000) }, { storeId: store.id, email: staff[4].email, normalizedEmail: staff[4].email, role: "inventory_staff", tokenHash: createHash("sha256").update(randomUUID()).digest("hex"), invitedBy: admin.id, expiresAt: new Date(today.getTime() + 86400000), acceptedAt: today }]);
    await seedExpenseWorkflow(tx, plan, context, store, index, newFiles);
    await tx.insert(schema.payRunsTable).values({ storeId: store.id, periodStart: `${plan.asOf.slice(0, 7)}-01`, periodEnd: monthEnd(plan.asOf.slice(0, 7)), status: "draft", demoOnly: true, clientRequestId: randomUUID(), payloadHash: HASH, createdBy: staff[2].id });
    await tx.insert(schema.auditLogsTable).values(["store.created", "inventory.restocked", "expense.submitted", "store.access.denied"].map(action => ({ actorUserId: admin.id, actorEmailSnapshot: admin.email, platformRole: "admin", storeId: store.id, action, resourceType: "recruiter_demo", outcome: action.endsWith("denied") ? "denied" as const : "success" as const, metadata: { preparedDemoEvidence: true } })));
  }
  for (const runId of Object.values(finance.payRunIds)) for (const [index, action] of (["calculate", "approve", "pay", "post"] as const).entries()) await tx.insert(schema.payRunCommandsTable).values({ payRunId: runId, action, idempotencyKey: randomUUID(), payloadHash: HASH, resultVersion: index + 2, actorId: index === 0 ? staff[2].id : admin.id });
  await tx.insert(schema.paymentWebhookEventsTable).values([{ eventId: "recruiter:payment:captured", eventType: "payment.captured", status: "processed", attempts: 1, processedAt: today }, { eventId: "recruiter:payment:failed", eventType: "payment.failed", status: "failed", attempts: 2, lastError: "Prepared webhook retry evidence; no live provider request" }]);
  const batchId = Object.values(finance.settlementIds)[0];
  const [batch] = await tx.select().from(schema.settlementBatchesTable).where(eq(schema.settlementBatchesTable.id, batchId));
  await tx.insert(schema.reconciliationIssuesTable).values({ storeId: batch.storeId, batchId, issueType: "duplicate", severity: "warning", status: "resolved", details: { preparedDemoEvidence: true, description: "Duplicate imported provider line excluded before reconciliation" }, resolutionNote: "Duplicate evidence checked and excluded", ownerUserId: staff[1].id, resolvedBy: admin.id, resolvedAt: today });
  const [reviewBatch] = await tx.insert(schema.settlementBatchesTable).values({ storeId: stores[1].id, provider: "razorpay", providerSettlementId: "recruiter-review-settlement", providerStatus: "processed", status: "needs_review", source: "fixture", periodFrom: today, periodTo: today, grossAmountPaise: 25000, feePaise: 500, feeTaxPaise: 90, adjustmentPaise: 0, netAmountPaise: 24410, settledAt: today, payloadHash: HASH, importedBy: staff[1].id }).returning();
  const [reviewLine] = await tx.insert(schema.settlementLinesTable).values({ batchId: reviewBatch.id, storeId: stores[1].id, providerLineId: "recruiter-unmatched-payment", providerTransactionId: "pay_recruiter_missing_local", providerEntityId: "pay_recruiter_missing_local", type: "payment", providerStatus: "captured", amountPaise: 25000, occurredAt: today, matchStatus: "unmatched", payloadHash: HASH }).returning();
  await tx.insert(schema.reconciliationIssuesTable).values({ storeId: stores[1].id, batchId: reviewBatch.id, settlementLineId: reviewLine.id, issueType: "missing_local", severity: "error", status: "open", ownerUserId: staff[1].id, details: { preparedDemoEvidence: true, description: "Imported payment has no matching local attempt. Review before reconciliation." } });
  for (const [index, status] of (["suspended", "revoked"] as const).entries()) {
    const [formerStaff] = await tx.insert(schema.usersTable).values({ fname: index === 0 ? "Nisha" : "Vikram", lname: "Menon", email: `${status}.staff@recruiter.pizzastore.test`, password: staff[0].password }).returning();
    await tx.insert(schema.storeMembershipsTable).values({ userId: formerStaff.id, storeId: stores[index].id, role: "operator", status, suspendedAt: status === "suspended" ? today : null, revokedAt: status === "revoked" ? today : null, createdBy: admin.id, updatedBy: admin.id });
    await tx.insert(schema.storeStaffInvitationsTable).values({ storeId: stores[index].id, email: formerStaff.email, normalizedEmail: formerStaff.email, role: "operator", tokenHash: createHash("sha256").update(randomUUID()).digest("hex"), invitedBy: admin.id, expiresAt: today, revokedAt: today });
  }
  await seedOperationalOrders(tx, plan, context, bundle);
}

async function seedStockHistory(tx: TransactionType, plan: RecruiterPlan, context: ExtraContext) {
  const maps = await tx.select().from(storeProductsTable);
  const remaining = new Map(maps.filter(row => row.onHandQuantity !== null).map(row => [row.id, row.onHandQuantity!]));
  for (const fixture of [...plan.orders].sort((a, b) => a.placedAt.localeCompare(b.placedAt))) for (const item of fixture.items) {
    const orderId = context.finance.orderIds[fixture.id];
    const product = context.products.find(row => row.slug === productSlugByFixtureId[item.productId])!;
    const mapped = maps.find(row => row.storeId === context.stores[fixture.storeId - 1].id && row.productId === product.id)!;
    const failed = fixture.paymentStatus === "failed";
    if (fixture.paymentMethod === "razorpay") await tx.insert(schema.inventoryReservationsTable).values({ orderId, storeProductId: mapped.id, quantity: item.quantity, status: failed ? "released" : "consumed", expiresAt: new Date(Date.parse(fixture.placedAt) + 900000), consumedAt: failed ? null : new Date(fixture.placedAt), releasedAt: failed ? new Date(fixture.placedAt) : null, createdAt: new Date(fixture.placedAt), updatedAt: new Date(fixture.placedAt) });
    if (failed) continue;
    const previousQuantity = remaining.get(mapped.id)!;
    const newQuantity = previousQuantity - item.quantity;
    if (newQuantity < 0) throw new Error("Insufficient opening stock for fixture history.");
    await tx.insert(schema.inventoryMovementsTable).values({ storeProductId: mapped.id, changeType: "sale", quantityChange: -item.quantity, previousQuantity, newQuantity, reason: "Recruiter showcase order", orderId, idempotencyKey: `recruiter:sale:${orderId}:${mapped.id}`, createdBy: context.staff[4].id, createdAt: new Date(fixture.placedAt) });
    remaining.set(mapped.id, newQuantity);
  }
  for (const [id, onHandQuantity] of remaining) await tx.update(storeProductsTable).set({ onHandQuantity }).where(eq(storeProductsTable.id, id));
}

async function seedExpenseWorkflow(tx: TransactionType, plan: RecruiterPlan, context: ExtraContext, store: ExtraContext["stores"][number], index: number, newFiles: string[]) {
  const { admin, staff } = context;
  const today = new Date(`${plan.asOf}T03:30:00Z`);
  const [vendor] = await tx.insert(schema.vendorsTable).values({ storeId: store.id, name: index === 0 ? "Konkan Fresh Produce" : "Garden City Food Supplies", normalizedName: index === 0 ? "konkan fresh produce" : "garden city food supplies", contactName: "Purchasing desk", email: `supplies${index}@pizzastore.example`, paymentTermsDays: 15, createdBy: admin.id, updatedBy: admin.id }).returning();
  const [account] = await tx.select().from(ledgerAccountsTable).where(eq(ledgerAccountsTable.code, "6900"));
  const [category] = await tx.select().from(schema.expenseCategoriesTable).limit(1);
  for (const status of ["draft", "submitted", "approved", "rejected", "voided"] as const) {
    const submitted = !["draft", "voided"].includes(status);
    const [expense] = await tx.insert(expensesTable).values({ storeId: store.id, vendorId: vendor.id, vendorName: vendor.name, expenseDate: plan.asOf, description: `${status === "rejected" ? "Duplicate" : "Fresh"} produce delivery — ${store.city}`, subtotalPaise: 85000, taxPaise: 4250, totalPaise: 89250, status, clientRequestId: randomUUID(), payloadHash: HASH, createdBy: staff[1].id, updatedBy: admin.id, submittedBy: submitted ? staff[1].id : null, submittedAt: submitted ? today : null, approvedBy: status === "approved" ? admin.id : null, approvedAt: status === "approved" ? today : null, rejectedBy: status === "rejected" ? admin.id : null, rejectedAt: status === "rejected" ? today : null, rejectionReason: status === "rejected" ? "Duplicate supplier invoice" : null, voidedBy: status === "voided" ? staff[1].id : null, voidedAt: status === "voided" ? today : null, voidReason: status === "voided" ? "Supplier replaced the invoice" : null, version: submitted ? status === "submitted" ? 2 : 3 : status === "voided" ? 2 : 1 }).returning();
    await tx.insert(schema.expenseAllocationsTable).values({ expenseId: expense.id, expenseStoreId: store.id, storeId: store.id, categoryId: category.id, categoryName: category.name, categoryClassification: category.classification, ledgerAccountId: account.id, amountPaise: expense.totalPaise, costCenter: "Kitchen" });
    if (submitted) await tx.insert(schema.expenseCommandsTable).values({ expenseId: expense.id, action: "submit", idempotencyKey: randomUUID(), payloadHash: HASH, resultVersion: 2, actorId: staff[1].id });
    if (status === "approved" || status === "rejected" || status === "voided") await tx.insert(schema.expenseCommandsTable).values({ expenseId: expense.id, action: status === "approved" ? "approve" : status === "rejected" ? "reject" : "void", idempotencyKey: randomUUID(), payloadHash: HASH, resultVersion: expense.version, actorId: admin.id });
    const sharp = (await import("sharp")).default;
    const bytes = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#fffaf3"/><g fill="#242424" font-family="sans-serif"><text x="60" y="80" font-size="34">${vendor.name}</text><text x="60" y="145" font-size="24">Portfolio sample receipt — ${plan.asOf}</text><text x="60" y="230" font-size="24">Fresh produce delivery</text><text x="60" y="310" font-size="24">Subtotal: INR 850.00</text><text x="60" y="365" font-size="24">Demo tax: INR 42.50</text><text x="60" y="440" font-size="30">Total: INR 892.50</text><text x="60" y="530" font-size="18">Prepared demonstration evidence. No supplier payment made.</text></g></svg>`)).png().toBuffer();
    const key = `${randomUUID()}.png`;
    const target = path.join(context.assetRoot, ".private", "expense-receipts", key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
    newFiles.push(target);
    await tx.insert(schema.expenseAttachmentsTable).values({ expenseId: expense.id, expenseStoreId: store.id, storageKey: key, originalName: "produce-receipt.png", mediaType: "image/png", sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), uploadedBy: staff[1].id });
  }
}

async function seedOperationalOrders(tx: TransactionType, plan: RecruiterPlan, context: ExtraContext, bundle: typeof productsTable.$inferSelect) {
  const { stores, staff, customers, products } = context;
  const today = new Date(`${plan.asOf}T03:30:00Z`);
  const pizza = products.find(product => product.slug === "margherita-pizza")!;
  const drink = products.find(product => product.slug === "coca-cola")!;
  for (const [index, status] of (["pending", "preparing", "out_for_delivery", "cancelled"] as const).entries()) {
    const store = stores[index % 2];
    const customer = customers[index];
    const [rule] = await tx.select().from(taxRulesTable).where(and(eq(taxRulesTable.storeId, store.id), eq(taxRulesTable.component, "item")));
    const [deliveryTaxRule] = await tx.select().from(taxRulesTable).where(and(eq(taxRulesTable.storeId, store.id), eq(taxRulesTable.component, "delivery")));
    const [deliveryRule] = await tx.select().from(deliveryPricingRulesTable).where(eq(deliveryPricingRulesTable.storeId, store.id));
    const bundleOrder = index === 1;
    const product = bundleOrder ? bundle : pizza;
    const itemTax = calculateInclusiveTax(product.pricePaise, rule.rateBps);
    const deliveryTax = calculateInclusiveTax(4000, deliveryTaxRule.rateBps);
    const [payment] = await tx.insert(paymentsTable).values({ provider: "cod", status: "pending", amountPaise: product.pricePaise + 4000, clientRequestId: randomUUID() }).returning();
    const [order] = await tx.insert(ordersTable).values({ userId: customer.id, addressId: customer.addresses[index % 2], storeId: store.id, orderDate: today, currency: "INR", status, paymentType: "cash", paymentId: payment.id, itemsSubtotalPaise: product.pricePaise, discountPaise: 0, deliveryFeePaise: 4000, taxableAmountPaise: itemTax.taxableAmountPaise + deliveryTax.taxableAmountPaise, taxPaise: itemTax.taxPaise + deliveryTax.taxPaise, roundingAdjustmentPaise: 0, grandTotalPaise: product.pricePaise + 4000, quoteVersion: "recruiter-operational-v1", pricingPolicyVersion: 5, deliveryPricingRuleId: deliveryRule.id, deliveryPricingRuleVersion: 1, pricingBusinessDate: plan.asOf, pricingTimezone: "Asia/Kolkata", taxCalculationPolicyVersion: 1, taxDisclaimer: rule.disclaimer, taxIsDemo: true, placeOfSupplyState: store.state, deliveryTaxRuleId: deliveryTaxRule.id, deliveryTaxRuleVersion: 1, deliveryTaxRateBps: deliveryTaxRule.rateBps, deliveryTaxableAmountPaise: deliveryTax.taxableAmountPaise, deliveryTaxPaise: deliveryTax.taxPaise, deliveryHsnSacCode: deliveryTaxRule.hsnSacCode, cancelledAt: status === "cancelled" ? today : null }).returning();
    const [item] = await tx.insert(orderItemsTable).values({ orderId: order.id, productId: product.id, productName: product.name, productType: product.productType, quantity: 1, unitPricePaise: product.pricePaise, compareAtUnitPricePaise: bundleOrder ? 35900 : null, bundleMarkdownPaise: bundleOrder ? 3000 : 0, lineSubtotalPaise: product.pricePaise, discountAllocationPaise: 0, taxableAmountPaise: itemTax.taxableAmountPaise, taxPaise: itemTax.taxPaise, lineTotalPaise: product.pricePaise, taxRuleId: rule.id, taxRuleVersion: 1, taxRateBps: rule.rateBps, hsnSacCode: rule.hsnSacCode }).returning();
    if (bundleOrder) await tx.insert(schema.orderItemBundleComponentsTable).values([pizza, drink].map(component => ({ orderItemId: item.id, componentProductId: component.id, componentName: component.name, quantityPerBundle: 1, totalQuantity: 1 })));
    await tx.insert(paymentAttemptsTable).values({ orderId: order.id, storeId: store.id, provider: "cod", method: "cash", status: status === "cancelled" ? "cancelled" : "pending", amountPaise: order.grandTotalPaise, clientRequestId: randomUUID() });
    for (const component of bundleOrder ? [pizza, drink] : [pizza]) {
      const [mapped] = await tx.select().from(storeProductsTable).where(and(eq(storeProductsTable.storeId, store.id), eq(storeProductsTable.productId, component.id)));
      const previousQuantity = mapped.onHandQuantity!;
      await tx.insert(schema.inventoryMovementsTable).values({ storeProductId: mapped.id, changeType: "sale", quantityChange: -1, previousQuantity, newQuantity: previousQuantity - 1, orderId: order.id, idempotencyKey: `recruiter:operational:${order.id}:${mapped.id}`, createdBy: staff[4].id, createdAt: today });
      if (status === "cancelled") await tx.insert(schema.inventoryMovementsTable).values({ storeProductId: mapped.id, changeType: "cancellation", quantityChange: 1, previousQuantity: previousQuantity - 1, newQuantity: previousQuantity, orderId: order.id, idempotencyKey: `recruiter:cancel:${order.id}:${mapped.id}`, createdBy: staff[4].id, createdAt: today });
      else await tx.update(storeProductsTable).set({ onHandQuantity: previousQuantity - 1 }).where(eq(storeProductsTable.id, mapped.id));
    }
  }
  for (const [index, slug] of ["grilled-chicken-wings", "fruit-punch"].entries()) {
    const product = products.find(row => row.slug === slug)!;
    const [mapped] = await tx.select().from(storeProductsTable).where(and(eq(storeProductsTable.storeId, stores[1].id), eq(storeProductsTable.productId, product.id)));
    const newQuantity = index === 0 ? 0 : 5;
    await tx.insert(schema.inventoryMovementsTable).values({ storeProductId: mapped.id, changeType: "adjustment", quantityChange: newQuantity - mapped.onHandQuantity!, previousQuantity: mapped.onHandQuantity!, newQuantity, reason: "Physical stock count for showcase low-stock scenarios", createdBy: staff[4].id, createdAt: today });
    await tx.update(storeProductsTable).set({ onHandQuantity: newQuantity }).where(eq(storeProductsTable.id, mapped.id));
  }
}

export async function main(args = process.argv.slice(2)) {
  if (!args.every(value => value === "--apply" || value === "--plan" || value.startsWith("--as-of=") || value.startsWith("--admin=")) || args.includes("--apply") && args.includes("--plan")) throw new Error("Usage: seed:recruiter [--plan | --apply] [--as-of=YYYY-MM-DD] [--admin=email]");
  const plan = buildRecruiterPlan(args.find(value => value.startsWith("--as-of="))?.slice(8));
  if (!args.includes("--apply")) {
    console.log(JSON.stringify({ mode: "plan — no database or files changed", asOf: plan.asOf, stores: plan.stores, customers: plan.customers + 1, staff: 7, products: productData.length + 1, historyOrders: plan.orders.length, operationalOrders: 4, schemaTables: Object.values(schema).filter(value => is(value, PgTable)).map(getTableName), run: "pnpm --filter backend seed:recruiter --apply" }, null, 2));
    return;
  }
  for (const image of new Set(productData.map(product => product.image))) await access(path.join(BACKEND_ROOT, image));
  const loadRuntime = createRequire(__filename);
  const { db, closeDatabase }: typeof import("../db/index") = loadRuntime("../db/index");
  const newFiles: string[] = [];
  let committed = false;
  try {
    const result = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('recruiter-demo-v1'))`);
      return seedShowcase(tx, plan, newFiles, args.find(value => value.startsWith("--admin="))?.slice(8));
    });
    committed = true;
    console.log(JSON.stringify(result, null, 2));
    console.log("Existing admin unchanged. Demo accounts: customer@recruiter.pizzastore.test, new.customer@recruiter.pizzastore.test, and manager/finance_manager/payroll_manager/operator/inventory_staff@recruiter.pizzastore.test.");
    console.log(process.env.RECRUITER_DEMO_PASSWORD ? "Demo password: supplied by RECRUITER_DEMO_PASSWORD." : `Demo password: ${PASSWORD}`);
    console.log("Payment history is prepared demo evidence. Start a fresh checkout to exercise the configured payment simulator. See docs/recruiter-demo.md.");
  } finally {
    if (!committed) for (const file of newFiles) await unlink(file).catch(() => {});
    await closeDatabase();
  }
}

export function describeSeedError(error: unknown): string {
  let cause = error;
  for (let depth = 0; depth < 8; depth++) {
    if (!cause || typeof cause !== "object" || !("cause" in cause) || !cause.cause) break;
    cause = cause.cause;
  }
  if (!cause || typeof cause !== "object" || !("message" in cause) || typeof cause.message !== "string") return "Recruiter seed failed";
  const code = "code" in cause && typeof cause.code === "string" ? `[${cause.code}] ` : "";
  const constraint = "constraint" in cause && typeof cause.constraint === "string" ? ` (constraint: ${cause.constraint})` : "";
  // Report the underlying error without logging SQL parameter values or credentials.
  return `${code}${cause.message}${constraint}`;
}

if (require.main === module) main().catch(cause => {
  console.error(describeSeedError(cause));
  process.exitCode = 1;
});



const PROMOTION_FIXTURE_VALIDITY = {
  startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2030-01-01T00:00:00.000Z",
  activeDaysOfWeek: null, activeStartTime: null, activeEndTime: null,
};
const PROMOTION_FIXTURE_OPT_OUT_NAME = "Demo pizza 10 percent";

// IDs come from the catalogue, never from assumptions about serial sequences.
function promotionFixtures(ids: { pizzaId: number; pizzaCategoryId: number }): PromotionDefinitionWriteInput[] {
  const base: PromotionDefinitionWriteInput = {
    kind: "offer", name: PROMOTION_FIXTURE_OPT_OUT_NAME,
    description: "10 percent off Margherita base price. No coupon stacking.", code: null,
    discount: { type: "percentage", rateBps: 1_000, maxDiscountPaise: 10_000 }, scope: "product",
    includeCustomizationValue: false,
    eligibility: { minimumOrderPaise: 0, minimumCartQuantity: 0, firstOrderOnly: false },
    validity: PROMOTION_FIXTURE_VALIDITY,
    limits: { perUserRedemptions: null, globalRedemptions: 1_000, budgetPaise: 5_000_000 },
    display: { priority: 100, showOnHomepage: true }, isActive: true,
    rules: [{ type: "product_include", productId: ids.pizzaId }],
  };
  const unfeatured = { priority: 10, showOnHomepage: false };
  return [
    base,
    { ...base, name: "Demo pizza 20 rupees off", description: "Fixed saving on pizza base prices; desktop artwork also serves mobile fallback.",
      scope: "category", discount: { type: "fixed_amount", amountPaise: 2_000 }, display: { priority: 90, showOnHomepage: true },
      rules: [{ type: "category_include", categoryId: ids.pizzaCategoryId }] },
    { ...base, name: "Demo buy two get one pizza", description: "Buy two pizzas and get one eligible pizza free; add three pizzas.",
      scope: "category", discount: { type: "buy_x_get_y" }, display: unfeatured,
      rules: [{ type: "buy_x_get_y", buyQuantity: 2, getQuantity: 1, buyProductIds: [], getProductIds: [],
        buyCategoryIds: [ids.pizzaCategoryId], getCategoryIds: [ids.pizzaCategoryId] }] },
    { ...base, name: "Demo delivery saving", description: "Waive charged delivery from an item subtotal of 200 rupees.",
      scope: "delivery", discount: { type: "free_delivery" }, display: unfeatured, rules: [],
      eligibility: { ...base.eligibility, minimumOrderPaise: 20_000 } },
    { ...base, name: "Demo cart tiers", description: "Save 5 percent from 1000 rupees or 10 percent from 2000 rupees.",
      scope: "cart", discount: { type: "tiered" }, display: unfeatured,
      rules: [
        { type: "tier", minimumSubtotalPaise: 100_000, discount: { type: "percentage", rateBps: 500, maxDiscountPaise: 20_000 } },
        { type: "tier", minimumSubtotalPaise: 200_000, discount: { type: "percentage", rateBps: 1_000, maxDiscountPaise: 40_000 } },
      ] },
    ...([
      { name: "Demo manual 10 percent", code: "DEMO10", discount: { type: "percentage", rateBps: 1_000, maxDiscountPaise: 10_000 } },
      { name: "Demo manual 30 rupees", code: "DEMO30", discount: { type: "fixed_amount", amountPaise: 3_000 } },
      { name: "Demo first-order tiers", code: "DEMOFIRST", discount: { type: "tiered" } },
    ] satisfies Pick<PromotionDefinitionWriteInput, "name" | "code" | "discount">[]).map((coupon) => ({
      ...base, ...coupon, kind: "coupon" as const, scope: "cart" as const, display: unfeatured,
      description: "Manual code only, on an offer-free cart without a deal combo.",
      eligibility: { ...base.eligibility, firstOrderOnly: coupon.code === "DEMOFIRST" },
      limits: { ...base.limits, perUserRedemptions: 2 },
      rules: coupon.discount.type === "tiered" ? [{ type: "tier" as const, minimumSubtotalPaise: 10_000,
        discount: { type: "fixed_amount" as const, amountPaise: 1_000 } }] : [],
    })),
  ].map((definition) => promotionDefinitionWriteSchema.parse(definition));
}

async function promotionFixtureArtwork(variant: "desktop" | "mobile", discount: "percentage" | "fixed_amount" = "percentage") {
  const sharp = (await import("sharp")).default;
  const width = variant === "desktop" ? PROMOTION_DESKTOP_MIN_WIDTH : PROMOTION_MOBILE_MIN_WIDTH;
  const height = variant === "desktop" ? PROMOTION_DESKTOP_MIN_HEIGHT : PROMOTION_MOBILE_MIN_HEIGHT;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#fff7e8"/>
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="28" fill="#155e3d"/>
    <g fill="#fff7e8" font-family="sans-serif">
      <text x="56" y="100" font-size="24">PIZZASTORE DEMO OFFER</text>
      <text x="56" y="180" font-size="52" font-weight="bold">${discount === "percentage" ? "Save 10%" : "Save Rs 20"}</text>
      <text x="56" y="235" font-size="24">${discount === "percentage" ? "Margherita base price" : "Pizza base prices"}</text>
      <text x="56" y="290" font-size="18">Checkout confirms eligibility.</text>
      <text x="56" y="325" font-size="18">Coupons cannot be combined.</text>
    </g>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
}
