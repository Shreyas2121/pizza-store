import type { AuthPrincipal } from "../auth/auth.types";
import { AppError } from "../../utils/error";
import { multiplyPaiseByQuantity, MONEY_CAPS } from "../../utils/money";
import type { TransactionType } from "../../utils/types";
import authorizationService, { resourceNotFound } from "../access/access.service";
import auditService from "../audit/audit.service";
import costRepository, { CostRepository } from "./cost.repository";
import type { CostsQuery, CreateCostVersionInput } from "./cost.schemas";

export interface OrderCostSnapshot {
  orderItemId: number;
  productId: number;
  quantity: number;
  costVersionId: number;
  unitCostPaise: number;
  lineCostPaise: number;
  lineSubtotalPaise: number;
  discountAllocationPaise: number;
  taxableAmountPaise: number;
  taxPaise: number;
  taxRateBps: number;
}

export interface CostSnapshotWriter {
  snapshotOrderItems(tx: TransactionType, input: {
    orderId: number; storeId: number; businessDate: string;
  }): Promise<OrderCostSnapshot[]>;
}

const costOverlap = () => new AppError(
  "The effective range overlaps an existing product cost version.", 422, "COST_VERSION_OVERLAP"
);

export class CostService implements CostSnapshotWriter {
  constructor(private readonly repository: CostRepository = costRepository) {}

  async list(actor: AuthPrincipal, query: CostsQuery) {
    await authorizationService.requireStorePermission({
      principal: actor, storeId: query.storeId, permission: "finance.costs.read",
    });
    return this.repository.list(query);
  }

  async create(actor: AuthPrincipal, input: CreateCostVersionInput) {
    const identity = await this.repository.findStoreProduct(input.storeProductId);
    if (!identity) throw resourceNotFound();
    await authorizationService.requireResourceStorePermission({
      principal: actor, resourceStoreId: identity.storeId, permission: "finance.costs.manage",
    });
    if (identity.storeId !== input.storeId) throw resourceNotFound();
    try {
      return await this.repository.transaction(async (tx) => {
        await authorizationService.requireResourceStorePermission({
          principal: actor, resourceStoreId: input.storeId, permission: "finance.costs.manage", tx,
        });
        const storeProduct = await this.repository.lockStoreProduct(tx, input.storeProductId);
        if (!storeProduct || storeProduct.storeId !== input.storeId) throw resourceNotFound();
        if (await this.repository.findOverlap(tx, input)) throw costOverlap();
        const created = await this.repository.create(tx, input, actor.userId);
        await auditService.write({
          tx, actor, storeId: input.storeId,
          action: "product_cost.version_created",
          resourceType: "product_cost_version",
          resourceId: created.id,
          after: {
            storeProductId: created.storeProductId,
            unitCostPaise: created.unitCostPaise,
            effectiveFrom: created.effectiveFrom,
            effectiveTo: created.effectiveTo,
            source: created.source,
          },
        });
        return created;
      });
    } catch (cause) {
      if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23P01") throw costOverlap();
      throw cause;
    }
  }

  async snapshotOrderItems(tx: TransactionType, input: {
    orderId: number; storeId: number; businessDate: string;
  }) {
    const items = await this.repository.listOrderItems(tx, input.orderId);
    const productIds = [...new Set(items.map((item) => item.productId))].sort((a, b) => a - b);
    const storeProducts = await this.repository.lockStoreProducts(tx, input.storeId, productIds);
    const mappingByProduct = new Map(storeProducts.map((item) => [item.productId, item]));
    if (mappingByProduct.size !== productIds.length) {
      throw new AppError("An order item is not mapped to this store.", 409, "STORE_PRODUCT_NOT_FOUND");
    }
    const versions = await this.repository.findEffectiveCosts(
      tx, storeProducts.map((item) => item.id), input.businessDate
    );
    const versionByStoreProduct = new Map(versions.map((item) => [item.storeProductId, item]));
    const snapshots: OrderCostSnapshot[] = [];
    for (const item of items) {
      if (item.costVersionId !== null && item.unitCostPaise !== null && item.lineCostPaise !== null) {
        snapshots.push({
          orderItemId: item.id, productId: item.productId, quantity: item.quantity,
          costVersionId: item.costVersionId, unitCostPaise: item.unitCostPaise, lineCostPaise: item.lineCostPaise,
          lineSubtotalPaise: item.lineSubtotalPaise,
          discountAllocationPaise: item.discountAllocationPaise,
          taxableAmountPaise: item.taxableAmountPaise,
          taxPaise: item.taxPaise,
          taxRateBps: item.taxRateBps,
        });
        continue;
      }
      const storeProduct = mappingByProduct.get(item.productId)!;
      const version = versionByStoreProduct.get(storeProduct.id);
      if (!version) {
        throw new AppError(
          `No standard cost is effective for order item ${item.id}.`, 422, "COST_VERSION_NOT_FOUND"
        );
      }
      const lineCostPaise = multiplyPaiseByQuantity(
        version.unitCostPaise, item.quantity, MONEY_CAPS.ORDER_AMOUNT
      );
      const snapshot = {
        orderItemId: item.id, productId: item.productId, quantity: item.quantity,
        costVersionId: version.id, unitCostPaise: version.unitCostPaise, lineCostPaise,
        lineSubtotalPaise: item.lineSubtotalPaise,
        discountAllocationPaise: item.discountAllocationPaise,
        taxableAmountPaise: item.taxableAmountPaise,
        taxPaise: item.taxPaise,
        taxRateBps: item.taxRateBps,
      };
      const updated = await this.repository.snapshotOrderItem(tx, snapshot);
      if (!updated) throw new AppError("Order cost snapshot was concurrently changed.", 409, "COST_SNAPSHOT_CONFLICT");
      snapshots.push(snapshot);
    }
    return snapshots;
  }
}

export default new CostService();
