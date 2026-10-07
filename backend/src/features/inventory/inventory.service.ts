import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  gt,
  ilike,
  inArray,
  isNotNull,
  lt,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../../db";
import {
  inventoryMovementsTable,
  inventoryReservationsTable,
  productsTable,
  storeProductsTable,
  storesTable,
  usersTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import type { AuthPrincipal } from "../auth/auth.types";
import authorizationService, { AuthorizationService } from "../access/access.service";
import auditService from "../audit/audit.service";
import type { AuditWriter } from "../audit/audit.types";
import type {
  InventoryChangeType,
  StockStatus,
  TransactionType,
} from "../../utils/types";
import {
  aggregateCartDemand,
  assertAdjustmentCoversReservations,
  calculateAdjustment,
  calculateDownwardThresholdCrossing,
  calculateRestock,
  type LowStockAlert,
  type StockAllocationItem,
  validateStockDemand,
} from "./inventory.logic";
import { expandBundleDemand } from "../bundles/bundle.logic";
import { loadBundleDefinitions } from "../bundles/bundle.repository";

import { INVENTORY_RESERVATION_DURATION_MS } from "./inventory.constants";
export { INVENTORY_RESERVATION_DURATION_MS } from "./inventory.constants";

type InventoryListStatus = "all" | "low_stock" | "out_of_stock";

interface InventoryListInput {
  status: InventoryListStatus;
  search?: string;
  page: number;
  limit: number;
}

interface MovementListInput {
  changeType?: InventoryChangeType;
  productId?: number;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

interface BulkRestockItem {
  productId: number;
  quantityAdded: number;
  reason?: string;
}

class InventoryService {
  constructor(
    private readonly authorization: AuthorizationService = authorizationService,
    private readonly audit: AuditWriter = auditService
  ) {}

  private activeReservationsSubquery() {
    return db
      .select({
        storeProductId: inventoryReservationsTable.storeProductId,
        reservedQuantity:
          sql<number>`coalesce(sum(${inventoryReservationsTable.quantity}), 0)::integer`.as(
            "reserved_quantity"
          ),
      })
      .from(inventoryReservationsTable)
      .where(eq(inventoryReservationsTable.status, "reserved"))
      .groupBy(inventoryReservationsTable.storeProductId)
      .as("active_inventory_reservations");
  }

  async lockStoreProducts(
    storeId: number,
    productIds: number[],
    tx: TransactionType
  ) {
    const uniqueProductIds = [...new Set(productIds)];
    if (uniqueProductIds.length === 0) return [];

    return await tx
      .select()
      .from(storeProductsTable)
      .where(
        and(
          eq(storeProductsTable.storeId, storeId),
          inArray(storeProductsTable.productId, uniqueProductIds)
        )
      )
      .orderBy(asc(storeProductsTable.id))
      .for("update");
  }

  async getActiveReservedQuantities(
    storeProductIds: number[],
    tx: TransactionType
  ) {
    const uniqueIds = [...new Set(storeProductIds)];
    if (uniqueIds.length === 0) return new Map<number, number>();

    const rows = await tx
      .select({
        storeProductId: inventoryReservationsTable.storeProductId,
        quantity:
          sql<number>`coalesce(sum(${inventoryReservationsTable.quantity}), 0)::integer`,
      })
      .from(inventoryReservationsTable)
      .where(
        and(
          eq(inventoryReservationsTable.status, "reserved"),
          inArray(inventoryReservationsTable.storeProductId, uniqueIds)
        )
      )
      .groupBy(inventoryReservationsTable.storeProductId);

    return new Map(
      rows.map((row) => [row.storeProductId, Number(row.quantity)] as const)
    );
  }

  async validateAndLockStock(
    storeId: number,
    items: Array<{
      productId: number;
      quantity: number;
      product?: { name: string; productType?: "single" | "bundle" };
      productName?: string;
      productType?: "single" | "bundle";
    }>,
    tx: TransactionType
  ): Promise<StockAllocationItem[]> {
    const definitions = await loadBundleDefinitions(
      items.map((item) => item.productId),
      storeId,
      tx
    );
    const missingBundleDefinitionIds = items
      .filter((item) => (item.product?.productType ?? item.productType) === "bundle")
      .map((item) => item.productId)
      .filter((productId) => !definitions.has(productId));
    if (missingBundleDefinitionIds.length > 0) {
      throw new AppError(
        "One or more bundles have no component definition",
        409,
        "BUNDLE_DEFINITION_INVALID",
        { productIds: [...new Set(missingBundleDefinitionIds)].sort((a, b) => a - b) }
      );
    }
    const demandByProduct = definitions.size > 0
      ? expandBundleDemand(items, definitions)
      : aggregateCartDemand(items);
    const productIds = [...demandByProduct.keys()];
    const lockedStoreProducts = await this.lockStoreProducts(
      storeId,
      productIds,
      tx
    );

    const reservedQuantities = await this.getActiveReservedQuantities(
      lockedStoreProducts.map((sp) => sp.id),
      tx
    );

    const productNameMap = new Map<number, string>();
    for (const item of items) {
      const name = item.product?.name ?? item.productName;
      if (name) {
        productNameMap.set(item.productId, name);
      }
    }
    for (const definition of definitions.values()) {
      for (const component of definition.components) {
        productNameMap.set(component.productId, component.name);
      }
    }

    const missingProductIds = productIds.filter(
      (id) => !productNameMap.has(id)
    );
    if (missingProductIds.length > 0) {
      const dbProducts = await tx
        .select({ id: productsTable.id, name: productsTable.name })
        .from(productsTable)
        .where(inArray(productsTable.id, missingProductIds));
      for (const p of dbProducts) {
        productNameMap.set(p.id, p.name);
      }
    }

    return validateStockDemand({
      demandByProduct,
      storeProducts: lockedStoreProducts,
      reservedQuantities,
      productNameMap,
    });
  }

  async deductStockForCod(
    data: {
      orderId: number;
      storeId: number;
      allocations: StockAllocationItem[];
    },
    tx: TransactionType
  ): Promise<LowStockAlert[]> {
    const alerts: LowStockAlert[] = [];

    for (const allocation of data.allocations) {
      if (!allocation.isTracked || allocation.onHandQuantity === null) {
        continue;
      }

      const demanded = allocation.demandedQuantity;
      const previousQuantity = allocation.onHandQuantity;
      const newQuantity = previousQuantity - demanded;

      await tx
        .update(storeProductsTable)
        .set({
          onHandQuantity: newQuantity,
          updatedAt: new Date(),
        })
        .where(eq(storeProductsTable.id, allocation.storeProductId));

      await tx.insert(inventoryMovementsTable).values({
        storeProductId: allocation.storeProductId,
        changeType: "sale",
        quantityChange: -demanded,
        previousQuantity,
        newQuantity,
        orderId: data.orderId,
        idempotencyKey: `sale:${data.orderId}:${allocation.storeProductId}`,
        createdBy: null,
      });

      const availableBefore = allocation.availableQuantity!;
      const availableAfter = Math.max(
        0,
        newQuantity - allocation.reservedQuantity
      );

      const alert = calculateDownwardThresholdCrossing({
        storeId: data.storeId,
        storeProductId: allocation.storeProductId,
        productId: allocation.productId,
        productName: allocation.productName,
        availableBefore,
        availableAfter,
        threshold: allocation.lowStockThreshold,
      });

      if (alert) {
        alerts.push(alert);
      }
    }

    return alerts;
  }

  async reserveStockForOrder(
    data: {
      orderId: number;
      storeId: number;
      allocations: StockAllocationItem[];
      expiresAt?: Date;
    },
    tx: TransactionType
  ): Promise<LowStockAlert[]> {
    const alerts: LowStockAlert[] = [];
    const expiresAt =
      data.expiresAt ?? new Date(Date.now() + INVENTORY_RESERVATION_DURATION_MS);

    for (const allocation of data.allocations) {
      if (!allocation.isTracked || allocation.onHandQuantity === null) {
        continue;
      }

      await tx.insert(inventoryReservationsTable).values({
        orderId: data.orderId,
        storeProductId: allocation.storeProductId,
        quantity: allocation.demandedQuantity,
        status: "reserved",
        expiresAt,
      });

      const availableBefore = allocation.availableQuantity!;
      const availableAfter = Math.max(
        0,
        availableBefore - allocation.demandedQuantity
      );

      const alert = calculateDownwardThresholdCrossing({
        storeId: data.storeId,
        storeProductId: allocation.storeProductId,
        productId: allocation.productId,
        productName: allocation.productName,
        availableBefore,
        availableAfter,
        threshold: allocation.lowStockThreshold,
      });

      if (alert) {
        alerts.push(alert);
      }
    }

    return alerts;
  }

  // Caller holds order/user/store locks. Use saved component demand, never a
  // current bundle definition, and validate the complete set before writing.
  async restoreReservationsForOrder(orderId: number, tx: TransactionType, now = new Date()) {
    const before = await tx.select().from(inventoryReservationsTable)
      .where(eq(inventoryReservationsTable.orderId, orderId));
    if (!before.length) return;
    const ids = [...new Set(before.map((row) => row.storeProductId))];
    const products = await tx.select().from(storeProductsTable)
      .where(inArray(storeProductsTable.id, ids))
      .orderBy(asc(storeProductsTable.id)).for("update");
    const rows = await tx.select().from(inventoryReservationsTable)
      .where(eq(inventoryReservationsTable.orderId, orderId))
      .orderBy(asc(inventoryReservationsTable.id)).for("update");
    if (rows.some((row) => row.status === "consumed"))
      throw new AppError("Inventory has already been consumed", 409, "INVENTORY_RESERVATIONS_STATE_CONFLICT");
    const released = rows.filter((row) => row.status === "released");
    const reserved = await this.getActiveReservedQuantities(ids, tx);
    const demand = new Map<number, number>();
    for (const row of released) demand.set(row.storeProductId, (demand.get(row.storeProductId) ?? 0) + row.quantity);
    for (const [id, quantity] of demand) {
      const product = products.find((row) => row.id === id);
      if (!product || !product.isAvailable ||
        (product.onHandQuantity !== null && product.onHandQuantity - (reserved.get(id) ?? 0) < quantity))
        throw new AppError("Inventory capacity is unavailable for retry", 409, "INSUFFICIENT_STOCK", { orderId, storeProductId: id });
    }
    if (released.length) await tx.update(inventoryReservationsTable).set({
      status: "reserved", releasedAt: null, consumedAt: null,
      expiresAt: new Date(now.getTime() + INVENTORY_RESERVATION_DURATION_MS), updatedAt: now,
    }).where(and(inArray(inventoryReservationsTable.id, released.map((row) => row.id)), eq(inventoryReservationsTable.status, "released")));
  }

  async consumeReservationsForOrder(
    orderId: number,
    tx: TransactionType
  ) {
    const existingReservations = await tx
      .select()
      .from(inventoryReservationsTable)
      .where(eq(inventoryReservationsTable.orderId, orderId));

    if (existingReservations.length === 0) {
      return { consumedCount: 0, alreadyConsumed: false };
    }

    const allConsumed = existingReservations.every(
      (r) => r.status === "consumed"
    );
    if (allConsumed) {
      return { consumedCount: 0, alreadyConsumed: true };
    }

    const anyReleased = existingReservations.some(
      (r) => r.status === "released"
    );
    if (anyReleased) {
      throw new AppError(
        "Payment reservations were released or expired",
        409,
        "INVENTORY_RESERVATIONS_RELEASED",
        { orderId }
      );
    }

    // Strict global lock order:
    // 1. Order + payment row lock (already held)
    // 2. store_products in ascending ID order
    // 3. inventory_reservations in ascending ID order
    // 4. inventory_movements append
    const storeProductIds = [
      ...new Set(existingReservations.map((r) => r.storeProductId)),
    ];
    const lockedStoreProducts = await tx
      .select()
      .from(storeProductsTable)
      .where(inArray(storeProductsTable.id, storeProductIds))
      .orderBy(asc(storeProductsTable.id))
      .for("update");
    const storeProductMap = new Map(
      lockedStoreProducts.map((sp) => [sp.id, sp])
    );

    const lockedReservations = await tx
      .select()
      .from(inventoryReservationsTable)
      .where(
        and(
          eq(inventoryReservationsTable.orderId, orderId),
          eq(inventoryReservationsTable.status, "reserved")
        )
      )
      .orderBy(asc(inventoryReservationsTable.id))
      .for("update");

    if (lockedReservations.length !== existingReservations.length) {
      throw new AppError(
        "Payment reservations state changed during finalization",
        409,
        "INVENTORY_RESERVATIONS_STATE_CONFLICT",
        { orderId }
      );
    }

    const now = new Date();
    for (const res of lockedReservations) {
      const sp = storeProductMap.get(res.storeProductId);
      if (!sp) throw new AppError("Reserved store product is missing", 409, "INVENTORY_RESERVATIONS_STATE_CONFLICT");

      await tx
        .update(inventoryReservationsTable)
        .set({
          status: "consumed",
          consumedAt: now,
          updatedAt: now,
        })
        .where(eq(inventoryReservationsTable.id, res.id));

      if (sp.onHandQuantity === null) continue;
      const previousQuantity = sp.onHandQuantity;
      const newQuantity = previousQuantity - res.quantity;

      await tx
        .update(storeProductsTable)
        .set({
          onHandQuantity: newQuantity,
          updatedAt: now,
        })
        .where(eq(storeProductsTable.id, sp.id));

      await tx.insert(inventoryMovementsTable).values({
        storeProductId: sp.id,
        changeType: "sale",
        quantityChange: -res.quantity,
        previousQuantity,
        newQuantity,
        orderId,
        idempotencyKey: `sale:${orderId}:${sp.id}`,
        createdBy: null,
      });
    }

    return {
      consumedCount: lockedReservations.length,
      alreadyConsumed: false,
    };
  }

  async getExpiredActiveReservationOrderIds(
    limit: number,
    tx?: TransactionType
  ): Promise<number[]> {
    const dbT = tx ?? db;
    const now = new Date();
    const rows = await dbT
      .selectDistinct({ orderId: inventoryReservationsTable.orderId })
      .from(inventoryReservationsTable)
      .where(
        and(
          eq(inventoryReservationsTable.status, "reserved"),
          lt(inventoryReservationsTable.expiresAt, now)
        )
      )
      .limit(limit);

    return rows.map((r) => r.orderId);
  }

  async restoreStockForOrder(
    data: {
      orderId: number;
      createdBy?: number | null;
    },
    tx: TransactionType
  ) {
    await this.releaseReservations(data.orderId, tx);

    const saleMovements = await tx
      .select()
      .from(inventoryMovementsTable)
      .where(
        and(
          eq(inventoryMovementsTable.orderId, data.orderId),
          eq(inventoryMovementsTable.changeType, "sale")
        )
      );

    if (saleMovements.length === 0) {
      return;
    }

    const existingCancellations = await tx
      .select({ storeProductId: inventoryMovementsTable.storeProductId })
      .from(inventoryMovementsTable)
      .where(
        and(
          eq(inventoryMovementsTable.orderId, data.orderId),
          eq(inventoryMovementsTable.changeType, "cancellation")
        )
      );
    const cancelledStoreProductIds = new Set(
      existingCancellations.map((c) => c.storeProductId)
    );

    const pendingRestorations = saleMovements.filter(
      (m) => !cancelledStoreProductIds.has(m.storeProductId)
    );
    if (pendingRestorations.length === 0) {
      return;
    }

    const storeProductIds = [
      ...new Set(pendingRestorations.map((m) => m.storeProductId)),
    ];
    const lockedStoreProducts = await tx
      .select()
      .from(storeProductsTable)
      .where(inArray(storeProductsTable.id, storeProductIds))
      .orderBy(asc(storeProductsTable.id))
      .for("update");

    const lockedMap = new Map(lockedStoreProducts.map((sp) => [sp.id, sp]));

    for (const sale of pendingRestorations) {
      const sp = lockedMap.get(sale.storeProductId);
      if (!sp) continue;

      const restoredQuantity = Math.abs(sale.quantityChange);
      if (sp.onHandQuantity !== null) {
        const previousQuantity = sp.onHandQuantity;
        const newQuantity = previousQuantity + restoredQuantity;

        await tx
          .update(storeProductsTable)
          .set({
            onHandQuantity: newQuantity,
            updatedAt: new Date(),
          })
          .where(eq(storeProductsTable.id, sp.id));

        await tx.insert(inventoryMovementsTable).values({
          storeProductId: sp.id,
          changeType: "cancellation",
          quantityChange: restoredQuantity,
          previousQuantity,
          newQuantity,
          orderId: data.orderId,
          idempotencyKey: `cancellation:${data.orderId}:${sp.id}`,
          createdBy: data.createdBy ?? null,
          reason: "Order cancelled",
        });
      }
    }
  }

  async releaseReservations(orderId: number, tx: TransactionType) {
    await tx
      .update(inventoryReservationsTable)
      .set({
        status: "released",
        releasedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventoryReservationsTable.orderId, orderId),
          eq(inventoryReservationsTable.status, "reserved")
        )
      );
  }

  async getStoreInventory(storeId: number, input: InventoryListInput, actor: AuthPrincipal) {
    await this.authorization.requireStorePermission({
      principal: actor,
      storeId,
      permission: "inventory.read",
    });
    await this.assertStoreExists(storeId);

    const activeReservations = this.activeReservationsSubquery();
    const reservedQuantity = sql<number>`coalesce(${activeReservations.reservedQuantity}, 0)::integer`;
    const availableQuantity = sql<number | null>`case
      when ${storeProductsTable.onHandQuantity} is null then null
      else greatest(${storeProductsTable.onHandQuantity} - ${reservedQuantity}, 0)
    end`;
    const stockStatus = sql<StockStatus>`case
      when ${storeProductsTable.onHandQuantity} is null then 'untracked'
      when ${availableQuantity} <= 0 then 'out_of_stock'
      when ${availableQuantity} <= ${storeProductsTable.lowStockThreshold} then 'low_stock'
      else 'in_stock'
    end`;

    const conditions: SQL[] = [eq(storeProductsTable.storeId, storeId)];
    if (input.search) {
      conditions.push(ilike(productsTable.name, `%${input.search}%`));
    }
    if (input.status === "low_stock") {
      conditions.push(
        isNotNull(storeProductsTable.onHandQuantity),
        gt(availableQuantity, 0),
        lte(availableQuantity, storeProductsTable.lowStockThreshold)
      );
    } else if (input.status === "out_of_stock") {
      conditions.push(
        isNotNull(storeProductsTable.onHandQuantity),
        lte(availableQuantity, 0)
      );
    }

    const whereClause = and(...conditions);
    const [{ total }] = await db
      .select({ total: count() })
      .from(storeProductsTable)
      .innerJoin(
        productsTable,
        eq(storeProductsTable.productId, productsTable.id)
      )
      .leftJoin(
        activeReservations,
        eq(activeReservations.storeProductId, storeProductsTable.id)
      )
      .where(whereClause);

    const offset = (input.page - 1) * input.limit;
    const items = await db
      .select({
        storeProductId: storeProductsTable.id,
        storeId: storeProductsTable.storeId,
        productId: storeProductsTable.productId,
        productName: productsTable.name,
        productImage: productsTable.image,
        pricePaise: storeProductsTable.pricePaise,
        isAvailable: storeProductsTable.isAvailable,
        productIsAvailable: productsTable.isAvailable,
        onHandQuantity: storeProductsTable.onHandQuantity,
        reservedQuantity,
        availableQuantity,
        lowStockThreshold: storeProductsTable.lowStockThreshold,
        lastRestockedAt: storeProductsTable.lastRestockedAt,
        stockStatus,
      })
      .from(storeProductsTable)
      .innerJoin(
        productsTable,
        eq(storeProductsTable.productId, productsTable.id)
      )
      .leftJoin(
        activeReservations,
        eq(activeReservations.storeProductId, storeProductsTable.id)
      )
      .where(whereClause)
      .orderBy(asc(productsTable.name), asc(storeProductsTable.id))
      .limit(input.limit)
      .offset(offset);

    const parsedTotal = Number(total);
    return {
      items,
      meta: {
        total: parsedTotal,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(parsedTotal / input.limit),
        hasNextPage: input.page * input.limit < parsedTotal,
      },
    };
  }

  async getProductInventory(storeId: number, productId: number, actor: AuthPrincipal) {
    await this.authorization.requireStorePermission({
      principal: actor,
      storeId,
      permission: "inventory.read",
    });
    const activeReservations = this.activeReservationsSubquery();
    const reservedQuantity = sql<number>`coalesce(${activeReservations.reservedQuantity}, 0)::integer`;
    const availableQuantity = sql<number | null>`case
      when ${storeProductsTable.onHandQuantity} is null then null
      else greatest(${storeProductsTable.onHandQuantity} - ${reservedQuantity}, 0)
    end`;
    const stockStatus = sql<StockStatus>`case
      when ${storeProductsTable.onHandQuantity} is null then 'untracked'
      when ${availableQuantity} <= 0 then 'out_of_stock'
      when ${availableQuantity} <= ${storeProductsTable.lowStockThreshold} then 'low_stock'
      else 'in_stock'
    end`;

    const [item] = await db
      .select({
        storeProductId: storeProductsTable.id,
        storeId: storeProductsTable.storeId,
        productId: storeProductsTable.productId,
        productName: productsTable.name,
        productImage: productsTable.image,
        pricePaise: storeProductsTable.pricePaise,
        isAvailable: storeProductsTable.isAvailable,
        productIsAvailable: productsTable.isAvailable,
        onHandQuantity: storeProductsTable.onHandQuantity,
        reservedQuantity,
        availableQuantity,
        lowStockThreshold: storeProductsTable.lowStockThreshold,
        lastRestockedAt: storeProductsTable.lastRestockedAt,
        stockStatus,
      })
      .from(storeProductsTable)
      .innerJoin(
        productsTable,
        eq(storeProductsTable.productId, productsTable.id)
      )
      .leftJoin(
        activeReservations,
        eq(activeReservations.storeProductId, storeProductsTable.id)
      )
      .where(
        and(
          eq(storeProductsTable.storeId, storeId),
          eq(storeProductsTable.productId, productId)
        )
      )
      .limit(1);

    if (!item) {
      throw new AppError(
        "Store product mapping not found",
        404,
        "STORE_PRODUCT_NOT_FOUND"
      );
    }

    const movements = await this.getMovements(storeId, {
      productId,
      page: 1,
      limit: 20,
    }, actor);

    return { ...item, recentMovements: movements.items };
  }

  async getMovements(storeId: number, input: MovementListInput, actor: AuthPrincipal) {
    await this.authorization.requireStorePermission({
      principal: actor,
      storeId,
      permission: "inventory.read",
    });
    await this.assertStoreExists(storeId);

    const conditions: SQL[] = [eq(storeProductsTable.storeId, storeId)];
    if (input.productId !== undefined) {
      conditions.push(eq(storeProductsTable.productId, input.productId));
    }
    if (input.changeType) {
      conditions.push(eq(inventoryMovementsTable.changeType, input.changeType));
    }
    if (input.from) {
      conditions.push(gte(inventoryMovementsTable.createdAt, input.from));
    }
    if (input.to) {
      conditions.push(lte(inventoryMovementsTable.createdAt, input.to));
    }
    const whereClause = and(...conditions);

    const [{ total }] = await db
      .select({ total: count() })
      .from(inventoryMovementsTable)
      .innerJoin(
        storeProductsTable,
        eq(inventoryMovementsTable.storeProductId, storeProductsTable.id)
      )
      .where(whereClause);

    const items = await db
      .select({
        id: inventoryMovementsTable.id,
        storeProductId: inventoryMovementsTable.storeProductId,
        productId: storeProductsTable.productId,
        productName: productsTable.name,
        changeType: inventoryMovementsTable.changeType,
        quantityChange: inventoryMovementsTable.quantityChange,
        previousQuantity: inventoryMovementsTable.previousQuantity,
        newQuantity: inventoryMovementsTable.newQuantity,
        reason: inventoryMovementsTable.reason,
        orderId: inventoryMovementsTable.orderId,
        createdBy: inventoryMovementsTable.createdBy,
        actorFirstName: usersTable.fname,
        actorLastName: usersTable.lname,
        createdAt: inventoryMovementsTable.createdAt,
      })
      .from(inventoryMovementsTable)
      .innerJoin(
        storeProductsTable,
        eq(inventoryMovementsTable.storeProductId, storeProductsTable.id)
      )
      .innerJoin(
        productsTable,
        eq(storeProductsTable.productId, productsTable.id)
      )
      .leftJoin(usersTable, eq(inventoryMovementsTable.createdBy, usersTable.id))
      .where(whereClause)
      .orderBy(desc(inventoryMovementsTable.createdAt))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit);

    const parsedTotal = Number(total);
    return {
      items,
      meta: {
        total: parsedTotal,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(parsedTotal / input.limit),
        hasNextPage: input.page * input.limit < parsedTotal,
      },
    };
  }

  async restockProduct(
    storeId: number,
    productId: number,
    data: { quantityAdded: number; reason?: string },
    actor: AuthPrincipal
  ) {
    return await db.transaction(async (tx) => {
      await this.authorization.requireStorePermission({
        principal: actor,
        storeId,
        permission: "inventory.restock",
        tx,
        lockMembership: true,
      });
      const mapping = await this.lockSingleStoreProduct(storeId, productId, tx);
      const change = calculateRestock(
        mapping.onHandQuantity,
        data.quantityAdded
      );
      const now = new Date();

      await tx
        .update(storeProductsTable)
        .set({
          onHandQuantity: change.newQuantity,
          lastRestockedAt: now,
          updatedAt: now,
        })
        .where(eq(storeProductsTable.id, mapping.id));

      await tx.insert(inventoryMovementsTable).values({
        storeProductId: mapping.id,
        changeType: "restock",
        quantityChange: change.quantityChange,
        previousQuantity: change.previousQuantity,
        newQuantity: change.newQuantity,
        reason: data.reason ?? null,
        createdBy: actor.userId,
      });

      await this.audit.write({
        tx,
        actor,
        storeId,
        action: "inventory.restocked",
        resourceType: "store_product",
        resourceId: mapping.id,
        before: { onHandQuantity: change.previousQuantity },
        after: { onHandQuantity: change.newQuantity },
        metadata: { productId },
      });

      return {
        storeProductId: mapping.id,
        productId,
        ...(await this.getProductName(productId, tx)),
        ...change,
        changeType: "restock" as const,
        lastRestockedAt: now,
      };
    });
  }

  async bulkRestockProducts(
    storeId: number,
    items: BulkRestockItem[],
    actor: AuthPrincipal,
    transaction?: TransactionType
  ) {
    if (items.length === 0) {
      throw new AppError(
        "At least one product is required",
        400,
        "BULK_RESTOCK_EMPTY"
      );
    }
    if (items.length > 50) {
      throw new AppError(
        "Bulk restock is limited to 50 products",
        400,
        "BULK_RESTOCK_LIMIT_EXCEEDED"
      );
    }

    const productIds = items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new AppError(
        "Duplicate product IDs are not allowed",
        400,
        "DUPLICATE_PRODUCT_IDS"
      );
    }

    const execute = async (tx: TransactionType) => {
      await this.authorization.requireStorePermission({
        principal: actor,
        storeId,
        permission: "inventory.restock",
        tx,
        lockMembership: true,
      });
      const lockedMappings = await this.lockStoreProducts(
        storeId,
        productIds,
        tx
      );
      const mappingsByProductId = new Map(
        lockedMappings.map((mapping) => [mapping.productId, mapping] as const)
      );
      const missingProductIds = productIds.filter(
        (productId) => !mappingsByProductId.has(productId)
      );
      if (missingProductIds.length > 0) {
        throw new AppError(
          "One or more products are not mapped to this store",
          404,
          "STORE_PRODUCT_NOT_FOUND",
          { productIds: missingProductIds }
        );
      }

      const inputByProductId = new Map(
        items.map((item) => [item.productId, item] as const)
      );
      const prepared = lockedMappings.map((mapping) => {
        const input = inputByProductId.get(mapping.productId)!;
        return {
          mapping,
          input,
          change: calculateRestock(
            mapping.onHandQuantity,
            input.quantityAdded
          ),
        };
      });
      const products = await tx
        .select({ id: productsTable.id, productName: productsTable.name })
        .from(productsTable)
        .where(inArray(productsTable.id, productIds));
      const productNames = new Map(
        products.map((product) => [product.id, product.productName] as const)
      );
      if (productNames.size !== productIds.length) {
        throw new AppError(
          "One or more products no longer exist",
          404,
          "PRODUCT_NOT_FOUND"
        );
      }
      const now = new Date();

      for (const { mapping, change } of prepared) {
        await tx
          .update(storeProductsTable)
          .set({
            onHandQuantity: change.newQuantity,
            lastRestockedAt: now,
            updatedAt: now,
          })
          .where(eq(storeProductsTable.id, mapping.id));
      }

      await tx.insert(inventoryMovementsTable).values(
        prepared.map(({ mapping, input, change }) => ({
          storeProductId: mapping.id,
          changeType: "restock" as const,
          quantityChange: change.quantityChange,
          previousQuantity: change.previousQuantity,
          newQuantity: change.newQuantity,
          reason: input.reason ?? null,
          createdBy: actor.userId,
        }))
      );

      await this.audit.write({
        tx,
        actor,
        storeId,
        action: "inventory.bulk_restocked",
        resourceType: "store",
        resourceId: storeId,
        metadata: { productCount: prepared.length },
      });

      return {
        updatedCount: prepared.length,
        items: prepared.map(({ mapping, change }) => ({
          storeProductId: mapping.id,
          productId: mapping.productId,
          productName: productNames.get(mapping.productId)!,
          ...change,
          lastRestockedAt: now,
        })),
      };
    };

    return transaction ? execute(transaction) : db.transaction(execute);
  }

  async adjustProduct(
    storeId: number,
    productId: number,
    data: { targetQuantity: number; reason: string },
    actor: AuthPrincipal
  ) {
    return await db.transaction(async (tx) => {
      await this.authorization.requireStorePermission({
        principal: actor,
        storeId,
        permission: "inventory.adjust",
        tx,
        lockMembership: true,
      });
      const mapping = await this.lockSingleStoreProduct(storeId, productId, tx);
      const reservedQuantities = await this.getActiveReservedQuantities(
        [mapping.id],
        tx
      );
      const reserved = reservedQuantities.get(mapping.id) ?? 0;
      assertAdjustmentCoversReservations(data.targetQuantity, reserved);
      const change = calculateAdjustment(
        mapping.onHandQuantity,
        data.targetQuantity
      );

      await tx
        .update(storeProductsTable)
        .set({ onHandQuantity: change.newQuantity, updatedAt: new Date() })
        .where(eq(storeProductsTable.id, mapping.id));

      await tx.insert(inventoryMovementsTable).values({
        storeProductId: mapping.id,
        changeType: "adjustment",
        quantityChange: change.quantityChange,
        previousQuantity: change.previousQuantity,
        newQuantity: change.newQuantity,
        reason: data.reason,
        createdBy: actor.userId,
      });

      await this.audit.write({
        tx,
        actor,
        storeId,
        action: "inventory.adjusted",
        resourceType: "store_product",
        resourceId: mapping.id,
        before: { onHandQuantity: change.previousQuantity },
        after: { onHandQuantity: change.newQuantity },
        metadata: { productId },
      });

      const productNameInfo = await this.getProductName(productId, tx);
      const availableBefore =
        mapping.onHandQuantity !== null
          ? Math.max(0, mapping.onHandQuantity - reserved)
          : 0;
      const availableAfter = Math.max(0, change.newQuantity - reserved);

      const alert = calculateDownwardThresholdCrossing({
        storeId,
        storeProductId: mapping.id,
        productId,
        productName: productNameInfo.productName,
        availableBefore,
        availableAfter,
        threshold: mapping.lowStockThreshold,
      });

      return {
        storeProductId: mapping.id,
        productId,
        ...productNameInfo,
        ...change,
        changeType: "adjustment" as const,
        alert: alert ?? undefined,
      };
    });
  }

  async updateThreshold(
    storeId: number,
    productId: number,
    threshold: number,
    actor: AuthPrincipal
  ) {
    return await db.transaction(async (tx) => {
      await this.authorization.requireStorePermission({
        principal: actor,
        storeId,
        permission: "inventory.threshold.update",
        tx,
        lockMembership: true,
      });
      const mapping = await this.lockSingleStoreProduct(storeId, productId, tx);
      const [updated] = await tx
        .update(storeProductsTable)
        .set({ lowStockThreshold: threshold, updatedAt: new Date() })
        .where(eq(storeProductsTable.id, mapping.id))
        .returning();
      await this.audit.write({
        tx,
        actor,
        storeId,
        action: "inventory.threshold_updated",
        resourceType: "store_product",
        resourceId: mapping.id,
        before: { lowStockThreshold: mapping.lowStockThreshold },
        after: { lowStockThreshold: threshold },
        metadata: { productId },
      });
      return updated;
    });
  }

  private async lockSingleStoreProduct(
    storeId: number,
    productId: number,
    tx: TransactionType
  ) {
    const [mapping] = await this.lockStoreProducts(storeId, [productId], tx);
    if (!mapping) {
      throw new AppError(
        "Store product mapping not found",
        404,
        "STORE_PRODUCT_NOT_FOUND"
      );
    }
    return mapping;
  }

  private async getProductName(productId: number, tx: TransactionType) {
    const [product] = await tx
      .select({ productName: productsTable.name })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);
    if (!product) throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    return product;
  }

  private async assertStoreExists(storeId: number) {
    const store = await db.query.storesTable.findFirst({
      where: eq(storesTable.id, storeId),
      columns: { id: true },
    });
    if (!store) throw new AppError("Store not found", 404, "STORE_NOT_FOUND");
  }
}

export { InventoryService };
export default new InventoryService();
