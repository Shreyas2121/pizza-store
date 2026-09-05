import type { AuthPrincipal } from "../auth/auth.types";
import type { TransactionType } from "../../utils/types";
import { AppError } from "../../utils/error";
import authorizationService, { resourceNotFound } from "../access/access.service";
import auditService from "../audit/audit.service";
import vendorRepository, { VendorRepository } from "./vendor.repository";
import type { CreateExpenseCategoryInput, CreateVendorInput, MasterListQuery, UpdateExpenseCategoryInput, UpdateVendorInput } from "./vendor.schemas";

const duplicateName = (resource: "vendor" | "expense category") => new AppError(
  `An active or inactive ${resource} with this normalized name already exists in the same scope.`,
  409,
  "MASTER_NAME_CONFLICT"
);
const isUniqueViolation = (cause: unknown) =>
  typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
const sameScope = (left: number | null | undefined, right: number | null | undefined) =>
  (left ?? null) === (right ?? null);

export class VendorService {
  constructor(private readonly repository: VendorRepository = vendorRepository) {}

  async listVendors(actor: AuthPrincipal, query: MasterListQuery) {
    await this.authorizeList(actor, query);
    return this.repository.listVendors(query);
  }

  async createVendor(actor: AuthPrincipal, input: CreateVendorInput) {
    const storeId = input.storeId ?? null;
    await this.authorizeWrite(actor, storeId);
    await this.requireStore(storeId);
    try {
      return await this.repository.transaction(async (tx) => {
        await this.authorizeWrite(actor, storeId, tx);
        const created = await this.repository.createVendor(tx, input, actor.userId);
        await auditService.write({ tx, actor, storeId, action: "vendor.created", resourceType: "vendor", resourceId: created.id, after: this.vendorAuditState(created) });
        return created;
      });
    } catch (cause) {
      if (isUniqueViolation(cause)) throw duplicateName("vendor");
      throw cause;
    }
  }

  async updateVendor(actor: AuthPrincipal, id: number, input: UpdateVendorInput) {
    const identity = await this.repository.findVendor(id);
    if (!identity) throw resourceNotFound();
    await this.authorizeResourceWrite(actor, identity.storeId);
    try {
      return await this.repository.transaction(async (tx) => {
        const current = await this.repository.lockVendor(tx, id);
        if (!current) throw resourceNotFound();
        await this.authorizeResourceWrite(actor, current.storeId, tx);
        const updated = await this.repository.updateVendor(tx, id, input, actor.userId);
        const action = current.isActive !== updated.isActive
          ? updated.isActive ? "vendor.reactivated" as const : "vendor.deactivated" as const
          : "vendor.updated" as const;
        await auditService.write({ tx, actor, storeId: current.storeId, action, resourceType: "vendor", resourceId: id, before: this.vendorAuditState(current), after: this.vendorAuditState(updated) });
        return updated;
      });
    } catch (cause) {
      if (isUniqueViolation(cause)) throw duplicateName("vendor");
      throw cause;
    }
  }

  async listCategories(actor: AuthPrincipal, query: MasterListQuery) {
    await this.authorizeList(actor, query);
    return this.repository.listCategories(query);
  }

  async createCategory(actor: AuthPrincipal, input: CreateExpenseCategoryInput) {
    const storeId = input.storeId ?? null;
    await this.authorizeWrite(actor, storeId);
    await this.requireStore(storeId);
    try {
      return await this.repository.transaction(async (tx) => {
        await this.authorizeWrite(actor, storeId, tx);
        await this.validateParent(tx, input.parentId ?? null, storeId);
        const created = await this.repository.createCategory(tx, input, actor.userId);
        await auditService.write({ tx, actor, storeId, action: "expense_category.created", resourceType: "expense_category", resourceId: created.id, after: this.categoryAuditState(created) });
        return created;
      });
    } catch (cause) {
      if (isUniqueViolation(cause)) throw duplicateName("expense category");
      throw cause;
    }
  }

  async updateCategory(actor: AuthPrincipal, id: number, input: UpdateExpenseCategoryInput) {
    const identity = await this.repository.findCategory(id);
    if (!identity) throw resourceNotFound();
    await this.authorizeResourceWrite(actor, identity.storeId);
    try {
      return await this.repository.transaction(async (tx) => {
        const current = await this.repository.lockCategory(tx, id);
        if (!current) throw resourceNotFound();
        await this.authorizeResourceWrite(actor, current.storeId, tx);
        const parentId = input.parentId === undefined ? current.parentId : input.parentId;
        await this.validateParent(tx, parentId, current.storeId, current.id, input.isActive ?? current.isActive);
        if (input.isActive === false && current.isActive && await this.repository.hasActiveChildren(id, tx)) {
          throw new AppError("Deactivate or move active child categories first.", 409, "ACTIVE_CATEGORY_CHILDREN");
        }
        const updated = await this.repository.updateCategory(tx, id, input, actor.userId);
        const action = current.isActive !== updated.isActive
          ? updated.isActive ? "expense_category.reactivated" as const : "expense_category.deactivated" as const
          : "expense_category.updated" as const;
        await auditService.write({ tx, actor, storeId: current.storeId, action, resourceType: "expense_category", resourceId: id, before: this.categoryAuditState(current), after: this.categoryAuditState(updated) });
        return updated;
      });
    } catch (cause) {
      if (isUniqueViolation(cause)) throw duplicateName("expense category");
      throw cause;
    }
  }

  private async authorizeList(actor: AuthPrincipal, query: MasterListQuery) {
    if (query.storeId === undefined) {
      authorizationService.requirePlatformAdmin(actor);
      return;
    }
    await authorizationService.requireStorePermission({ principal: actor, storeId: query.storeId, permission: "finance.expenses.read" });
  }

  private async authorizeWrite(actor: AuthPrincipal, storeId: number | null, tx?: TransactionType) {
    if (storeId === null) {
      authorizationService.requirePlatformAdmin(actor);
      return;
    }
    await authorizationService.requireStorePermission({ principal: actor, storeId, permission: "finance.expenses.create", tx, lockMembership: Boolean(tx) && actor.platformRole !== "admin" });
  }

  private async authorizeResourceWrite(actor: AuthPrincipal, storeId: number | null, tx?: TransactionType) {
    if (storeId === null) {
      authorizationService.requirePlatformAdmin(actor);
      return;
    }
    await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: storeId, permission: "finance.expenses.create", tx });
  }

  private async requireStore(storeId: number | null) {
    if (storeId !== null && !await this.repository.findStore(storeId)) throw resourceNotFound();
  }

  private async validateParent(tx: TransactionType, parentId: number | null, storeId: number | null, childId?: number, requireActive = true) {
    if (parentId === null) return;
    const visited = new Set<number>(childId === undefined ? [] : [childId]);
    let cursor: number | null = parentId;
    while (cursor !== null) {
      if (visited.has(cursor)) throw new AppError("Expense category hierarchy cannot contain a cycle.", 422, "CATEGORY_HIERARCHY_CYCLE");
      visited.add(cursor);
      const parent = await this.repository.findCategory(cursor, tx);
      if (!parent || !sameScope(parent.storeId, storeId)) throw resourceNotFound();
      if (requireActive && !parent.isActive) throw new AppError("The parent expense category is inactive.", 422, "INACTIVE_PARENT_CATEGORY");
      cursor = parent.parentId;
      if (visited.size > 100) throw new AppError("Expense category hierarchy is too deep.", 422, "CATEGORY_HIERARCHY_TOO_DEEP");
    }
  }

  private vendorAuditState(value: { storeId: number | null; name: string; normalizedName: string; paymentTermsDays: number; isActive: boolean }) {
    return { storeId: value.storeId, name: value.name, normalizedName: value.normalizedName, paymentTermsDays: value.paymentTermsDays, isActive: value.isActive };
  }

  private categoryAuditState(value: { storeId: number | null; parentId: number | null; name: string; normalizedName: string; classification: string; ledgerAccountId: number | null; isActive: boolean }) {
    return { storeId: value.storeId, parentId: value.parentId, name: value.name, normalizedName: value.normalizedName, classification: value.classification, ledgerAccountId: value.ledgerAccountId, isActive: value.isActive };
  }
}

export default new VendorService();
