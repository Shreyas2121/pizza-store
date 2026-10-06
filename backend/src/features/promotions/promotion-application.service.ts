import { PROMOTION_ERROR_CODES } from "./promotion.constants";
import { AppError } from "../../utils/error";
import { addPaise, MAX_POSTGRES_INT } from "../../utils/money";
import type { TransactionType } from "../../utils/types";
import type { PricingQuote } from "../pricing";
import {
  PromotionApplicationRepository,
  type ApplicationRow,
  type ApplicationWrite,
  type AllocationWrite,
} from "./promotion-application.repository";

type Owner = Awaited<ReturnType<PromotionApplicationRepository["lockOwner"]>>;
type Definitions = Awaited<
  ReturnType<PromotionApplicationRepository["lockDefinitions"]>
>;
const mismatch = () =>
  new AppError(
    "Promotion snapshots do not match the order",
    409,
    PROMOTION_ERROR_CODES.APPLICATION_MISMATCH,
  );
const immutableKeys = [
  "promotionId",
  "orderId",
  "userId",
  "storeId",
  "promotionKind",
  "promotionName",
  "promotionCode",
  "discountType",
  "definitionVersion",
  "itemDiscountPaise",
  "deliveryDiscountPaise",
  "totalSavingsPaise",
  "standardDeliveryFeePaise",
  "chargedDeliveryFeePaise",
] as const;
const allocationKey = (
  row: Pick<
    AllocationWrite,
    "orderItemId" | "component" | "unitIndex" | "amountPaise"
  >,
) =>
  `${row.component}:${row.orderItemId ?? "delivery"}:${row.unitIndex ?? "delivery"}:${row.amountPaise}`;

export class PromotionApplicationService {
  constructor(
    private readonly repository = new PromotionApplicationRepository(),
    private readonly clock = () => new Date(),
  ) {}

  // Caller owns the order transaction. No independent transactions or counters.
  async record(
    orderId: number,
    quote: PricingQuote,
    itemIds: ReadonlyMap<number, number>,
    status: "reserved" | "consumed",
    tx: TransactionType,
    now = this.clock(),
  ) {
    const owner = await this.repository.lockOwner(orderId, tx);
    if (
      owner.discountMode !== quote.discountMode ||
      owner.storeId !== quote.deliveryPricing.storeId ||
      owner.discountPaise !== quote.itemDiscountPaise ||
      owner.deliveryFeePaise !== quote.chargedDeliveryFeePaise ||
      owner.grandTotalPaise !== quote.grandTotalPaise
    )
      throw mismatch();
    if (
      itemIds.size !== quote.items.length ||
      new Set(itemIds.values()).size !== itemIds.size ||
      quote.items.some((item) => !itemIds.has(item.lineId))
    )
      throw mismatch();
    const ids = quote.promotions.map((p) => p.id);
    if (
      new Set(ids).size !== ids.length ||
      (quote.discountMode === "coupon"
        ? quote.promotions.length !== 1 || quote.promotions[0].kind !== "coupon"
        : quote.promotions.some((p) => p.kind === "coupon")) ||
      (quote.discountMode === "none" && ids.length)
    )
      throw mismatch();
    const sum = (values: number[]) => addPaise(values, MAX_POSTGRES_INT);
    if (
      sum(quote.promotions.map((p) => p.itemDiscountPaise)) !==
        quote.itemDiscountPaise ||
      sum(quote.promotions.map((p) => p.deliveryDiscountPaise)) !==
        quote.deliveryDiscountPaise ||
      sum(quote.promotions.map((p) => p.totalSavingsPaise)) !==
        quote.promotionSavingsPaise ||
      sum([quote.chargedDeliveryFeePaise, quote.deliveryDiscountPaise]) !==
        quote.standardDeliveryFeePaise
    )
      throw mismatch();
    const seenUnits = new Set<string>();
    const lineDiscounts = new Map<number, number>();
    const snapshots: ApplicationWrite[] = [];
    const allocations = new Map<
      number,
      Omit<AllocationWrite, "promotionApplicationId">[]
    >();
    for (const promotion of quote.promotions) {
      if (
        promotion.totalSavingsPaise <= 0 ||
        sum([promotion.itemDiscountPaise, promotion.deliveryDiscountPaise]) !==
          promotion.totalSavingsPaise
      )
        throw mismatch();
      let itemSum = 0,
        deliverySum = 0;
      const rows: Omit<AllocationWrite, "promotionApplicationId">[] = [];
      for (const allocation of promotion.allocations) {
        if (
          !Number.isSafeInteger(allocation.amountPaise) ||
          allocation.amountPaise <= 0
        )
          throw mismatch();
        if (allocation.component === "delivery") {
          if (
            allocation.lineId !== null ||
            allocation.unitIndexes.length ||
            deliverySum
          )
            throw mismatch();
          deliverySum = allocation.amountPaise;
          rows.push({
            component: "delivery",
            orderItemId: null,
            unitIndex: null,
            amountPaise: allocation.amountPaise,
            createdAt: now,
          });
        } else {
          // The engine emits one allocation per unit; reject ambiguous aggregates.
          const line = quote.items.find(
            (item) => item.lineId === allocation.lineId,
          );
          const orderItemId =
            allocation.lineId === null
              ? undefined
              : itemIds.get(allocation.lineId);
          const unit = allocation.unitIndexes[0];
          if (
            !line ||
            !orderItemId ||
            allocation.unitIndexes.length !== 1 ||
            !Number.isSafeInteger(unit) ||
            unit < 0 ||
            unit >= line.quantity ||
            allocation.amountPaise > line.unitPricePaise
          )
            throw mismatch();
          const key = `${line.lineId}:${unit}`;
          if (seenUnits.has(key)) throw mismatch();
          seenUnits.add(key);
          lineDiscounts.set(
            line.lineId,
            sum([lineDiscounts.get(line.lineId) ?? 0, allocation.amountPaise]),
          );
          itemSum = sum([itemSum, allocation.amountPaise]);
          rows.push({
            component: "item",
            orderItemId,
            unitIndex: unit,
            amountPaise: allocation.amountPaise,
            createdAt: now,
          });
        }
      }
      if (
        itemSum !== promotion.itemDiscountPaise ||
        deliverySum !== promotion.deliveryDiscountPaise
      )
        throw mismatch();
      allocations.set(promotion.id, rows);
      snapshots.push({
        promotionId: promotion.id,
        orderId,
        userId: owner.userId,
        storeId: owner.storeId,
        promotionKind: promotion.kind,
        promotionName: promotion.name,
        promotionCode: promotion.code,
        discountType: promotion.discountType,
        definitionVersion: promotion.definitionVersion,
        status,
        itemDiscountPaise: itemSum,
        deliveryDiscountPaise: deliverySum,
        totalSavingsPaise: promotion.totalSavingsPaise,
        standardDeliveryFeePaise: quote.standardDeliveryFeePaise,
        chargedDeliveryFeePaise: quote.chargedDeliveryFeePaise,
        reservedAt: status === "reserved" ? now : null,
        consumedAt: status === "consumed" ? now : null,
        releasedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (
      quote.items.some(
        (item) =>
          (lineDiscounts.get(item.lineId) ?? 0) !== item.itemDiscountPaise,
      )
    )
      throw mismatch();
    const definitions = await this.repository.lockDefinitions(
      ids,
      owner.storeId,
      tx,
    );
    const existing = await this.repository.applications(orderId, tx, true);
    if (existing.length) {
      if (existing.length !== snapshots.length) throw mismatch();
      const savedAllocations = await this.repository.allocations(
        existing.map((a) => a.id),
        tx,
      );
      for (const snapshot of snapshots) {
        const saved = existing.find(
          (a) => a.promotionId === snapshot.promotionId,
        );
        if (
          !saved ||
          saved.status !== status ||
          immutableKeys.some((key) => saved[key] !== snapshot[key])
        )
          throw mismatch();
        const actual = savedAllocations
          .filter((a) => a.promotionApplicationId === saved.id)
          .map(allocationKey)
          .sort();
        const expected = (allocations.get(saved.promotionId) ?? [])
          .map(allocationKey)
          .sort();
        if (JSON.stringify(actual) !== JSON.stringify(expected))
          throw mismatch();
      }
      return existing;
    }
    for (const snapshot of snapshots) {
      const definition = definitions.promotions.find(
        (p) => p.id === snapshot.promotionId,
      );
      if (
        !definition ||
        definition.definitionVersion !== snapshot.definitionVersion ||
        definition.kind !== snapshot.promotionKind ||
        definition.name !== snapshot.promotionName ||
        definition.code !== snapshot.promotionCode ||
        definition.discountType !== snapshot.discountType ||
        !definition.isActive ||
        definition.startsAt > now ||
        definition.endsAt <= now ||
        definitions.settings.some(
          (s) => s.promotionId === definition.id && !s.isEnabled,
        )
      )
        throw new AppError(
          "Promotion changed before checkout",
          409,
          PROMOTION_ERROR_CODES.VERSION_CONFLICT,
        );
    }
    await this.assertCapacity(snapshots, owner.userId, definitions, tx);
    const inserted = await this.repository.insert(snapshots, tx);
    if (
      inserted.length !== snapshots.length ||
      new Set(inserted.map((a) => a.promotionId)).size !== snapshots.length
    )
      throw mismatch();
    const allocationWrites = inserted.flatMap((a) => {
      const rows = allocations.get(a.promotionId);
      if (!rows) throw mismatch();
      return rows.map((row) => ({ ...row, promotionApplicationId: a.id }));
    });
    await this.repository.insertAllocations(allocationWrites, tx);
    return inserted;
  }

  private async lockedCollection(orderId: number, tx: TransactionType) {
    const owner = await this.repository.lockOwner(orderId, tx);
    const before = await this.repository.applications(orderId, tx);
    const definitions = await this.repository.lockDefinitions(
      before.map((a) => a.promotionId),
      owner.storeId,
      tx,
    );
    const rows = await this.repository.applications(orderId, tx, true);
    if (
      before.length !== rows.length ||
      before.some(
        (a) =>
          !rows.some((b) => a.id === b.id && a.promotionId === b.promotionId),
      ) ||
      rows.some(
        (a) => a.userId !== owner.userId || a.storeId !== owner.storeId,
      ) ||
      (owner.discountMode === "coupon" &&
        (rows.length !== 1 || rows[0].promotionKind !== "coupon"))
    )
      throw mismatch();
    if (
      addPaise(
        rows.map((a) => a.itemDiscountPaise),
        MAX_POSTGRES_INT,
      ) !== owner.discountPaise ||
      rows.some((a) => a.chargedDeliveryFeePaise !== owner.deliveryFeePaise) ||
      (owner.discountMode !== "coupon" &&
        rows.some((a) => a.promotionKind === "coupon")) ||
      (owner.discountMode === "none" && rows.length)
    )
      throw mismatch();
    if (
      rows.length &&
      (rows.some(
        (a) => a.standardDeliveryFeePaise !== rows[0].standardDeliveryFeePaise,
      ) ||
        addPaise(
          rows.map((a) => a.deliveryDiscountPaise),
          MAX_POSTGRES_INT,
        ) !==
          rows[0].standardDeliveryFeePaise - owner.deliveryFeePaise)
    )
      throw mismatch();
    const allocations = await this.repository.allocations(
      rows.map((a) => a.id),
      tx,
    );
    const units = new Set<string>();
    for (const row of rows) {
      const saved = allocations.filter(
        (a) => a.promotionApplicationId === row.id,
      );
      if (
        addPaise(
          saved.filter((a) => a.component === "item").map((a) => a.amountPaise),
          MAX_POSTGRES_INT,
        ) !== row.itemDiscountPaise ||
        addPaise(
          saved
            .filter((a) => a.component === "delivery")
            .map((a) => a.amountPaise),
          MAX_POSTGRES_INT,
        ) !== row.deliveryDiscountPaise
      )
        throw mismatch();
      for (const allocation of saved.filter((a) => a.component === "item")) {
        const key = `${allocation.orderItemId}:${allocation.unitIndex}`;
        if (units.has(key)) throw mismatch();
        units.add(key);
      }
    }
    return { owner, definitions, rows };
  }
  async release(orderId: number, tx: TransactionType, now = this.clock()) {
    const { rows } = await this.lockedCollection(orderId, tx);
    // Consumption is immutable usage truth, including cancelled COD orders.
    await this.repository.transition(
      rows.filter((a) => a.status === "reserved").map((a) => a.id),
      "reserved",
      "released",
      now,
      tx,
    );
  }
  async consume(orderId: number, tx: TransactionType, now = this.clock()) {
    const { rows } = await this.lockedCollection(orderId, tx);
    if (rows.some((a) => a.status === "released"))
      throw new AppError(
        "Restore released promotions before consuming",
        409,
        PROMOTION_ERROR_CODES.RESERVATION_RELEASED,
      );
    await this.repository.transition(
      rows.filter((a) => a.status === "reserved").map((a) => a.id),
      "reserved",
      "consumed",
      now,
      tx,
    );
  }
  async restore(
    orderId: number,
    tx: TransactionType,
    now = this.clock(),
    enforceCapacity = true,
  ) {
    const { rows, owner, definitions } = await this.lockedCollection(
      orderId,
      tx,
    );
    if (rows.some((a) => a.status === "consumed"))
      throw new AppError(
        "Promotion has already been consumed",
        409,
        PROMOTION_ERROR_CODES.ALREADY_CONSUMED,
      );
    const released = rows.filter((a) => a.status === "released");
    // Edits and store opt-out never reprice captured reservations. C08 may bypass
    // capacity only when reconciling an authoritative provider capture.
    if (enforceCapacity)
      await this.assertCapacity(released, owner.userId, definitions, tx);
    await this.repository.transition(
      released.map((a) => a.id),
      "released",
      "reserved",
      now,
      tx,
    );
  }
  private async assertCapacity(
    rows: Array<Pick<ApplicationRow, "promotionId" | "totalSavingsPaise">>,
    userId: Owner["userId"],
    definitions: Definitions,
    tx: TransactionType,
  ) {
    const usage = await this.repository.usage(
      rows.map((a) => a.promotionId),
      userId,
      tx,
    );
    for (const row of rows) {
      const definition = definitions.promotions.find(
        (p) => p.id === row.promotionId,
      );
      if (!definition) throw mismatch();
      const used = usage.find((u) => u.promotionId === row.promotionId);
      const count = BigInt(used?.count ?? "0"),
        userCount = BigInt(used?.userCount ?? "0"),
        budget = BigInt(used?.budget ?? "0");
      if (
        (definition.maxRedemptions !== null &&
          count >= BigInt(definition.maxRedemptions)) ||
        (definition.perUserRedemptionLimit !== null &&
          userCount >= BigInt(definition.perUserRedemptionLimit))
      )
        throw new AppError(
          "Promotion capacity is unavailable",
          409,
          PROMOTION_ERROR_CODES.CAPACITY_EXHAUSTED,
        );
      if (
        definition.totalDiscountBudgetPaise !== null &&
        budget + BigInt(row.totalSavingsPaise) >
          BigInt(definition.totalDiscountBudgetPaise)
      )
        throw new AppError(
          "Promotion budget is unavailable",
          409,
          PROMOTION_ERROR_CODES.BUDGET_EXHAUSTED,
        );
    }
  }
}
export default new PromotionApplicationService();
