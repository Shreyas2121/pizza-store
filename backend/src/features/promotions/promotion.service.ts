import type { AuthPrincipal } from "../auth/auth.types";
import defaultAuthorization, {
  AuthorizationService,
  permissionDenied,
} from "../access/access.service";
import defaultAudit from "../audit/audit.service";
import type { AuditWriter } from "../audit/audit.types";
import { AppError } from "../../utils/error";
import { MAX_POSTGRES_INT } from "../../utils/money";
import type { TransactionType } from "../../utils/types";
import defaultRepository, { PromotionRepository } from "./promotion.repository";
import defaultAnalytics, {
  PromotionAnalyticsRepository,
  promotionAnalyticsTotalsSchema,
} from "./promotion-analytics.repository";
import defaultStorage, {
  PromotionMediaStorage,
  validatePromotionMedia,
  type PromotionMediaFile,
} from "./promotion-media.storage";
import {
  PROMOTION_AUDIT_ACTIONS,
  PROMOTION_DEFINITION_INITIAL_VERSION,
  PROMOTION_ERROR_CODES,
} from "./promotion.constants";
import {
  definitionToValues,
  emptyPromotionUsage,
  toEffectiveStoreDto,
  toPromotionAdminDto,
  toPublicOfferDto,
  type PromotionRow,
  type RuleRow,
} from "./promotion.mapper";
import {
  promotionAnalyticsQuerySchema,
  promotionDefinitionWriteSchema,
  promotionListQuerySchema,
  promotionMediaMetadataSchema,
  promotionUpdateRequestSchema,
  storePromotionSettingWriteSchema,
} from "./promotion.schemas";
import type { PromotionMediaVariant } from "./promotion.types";
import { parsePromotionRequest } from "./promotion.validation";

const notFound = () =>
  new AppError("Promotion not found", 404, PROMOTION_ERROR_CODES.NOT_FOUND);
const nextVersion = (current: number) => {
  if (current >= MAX_POSTGRES_INT)
    throw new AppError(
      "Promotion version exhausted",
      409,
      PROMOTION_ERROR_CODES.VERSION_CONFLICT,
    );
  return current + 1;
};
const requireHomepageMedia = (show: boolean, row?: PromotionRow) => {
  if (show && (!row?.imageUrl || !row.imageAlt?.trim()))
    throw new AppError(
      "Desktop image and alt text are required for homepage placement",
      400,
      PROMOTION_ERROR_CODES.MEDIA_REQUIRED_FOR_HOMEPAGE,
    );
};
const auditState = (dto: ReturnType<typeof toPromotionAdminDto>) => {
  const state: Record<string, unknown> = { ...dto };
  delete state.code;
  return state;
};

export class PromotionService {
  constructor(
    private readonly repository: PromotionRepository = defaultRepository,
    private readonly authorization: AuthorizationService = defaultAuthorization,
    private readonly audit: AuditWriter = defaultAudit,
    private readonly storage: PromotionMediaStorage = defaultStorage,
    private readonly analytics: PromotionAnalyticsRepository = defaultAnalytics,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  requireAdmin(actor: AuthPrincipal | undefined) {
    this.authorization.requirePlatformAdmin(
      actor,
      "platform.promotions.manage",
    );
  }
  async requireManager(
    actor: AuthPrincipal,
    storeId: number,
    tx?: TransactionType,
  ) {
    // The general store permission service permits platform overrides. This
    // contract deliberately reserves participation choices for a store manager.
    if (actor.platformRole === "admin") throw permissionDenied();
    const access = await this.authorization.requireStorePermission({
      principal: actor,
      storeId,
      permission: "store.promotions.toggle",
      tx,
      lockMembership: tx !== undefined,
    });
    if (access.access !== "membership" || access.membershipRole !== "manager")
      throw permissionDenied();
  }
  private async dto(row: PromotionRow, tx?: TransactionType) {
    const related = await this.repository.related([row.id], undefined, tx);
    return toPromotionAdminDto(
      row,
      related.rules,
      related.usage.get(row.id) ?? emptyPromotionUsage,
      this.clock(),
    );
  }
  private mapDatabaseFailure(error: unknown): never {
    const cause =
      error && typeof error === "object" && "cause" in error
        ? error.cause
        : error;
    const code =
      cause && typeof cause === "object" && "code" in cause
        ? cause.code
        : undefined;
    if (code === "23505")
      throw new AppError(
        "Promotion code already exists",
        400,
        PROMOTION_ERROR_CODES.INVALID_DEFINITION,
      );
    if (code === "23503" || code === "23514")
      throw new AppError(
        "Invalid promotion definition or target",
        400,
        PROMOTION_ERROR_CODES.INVALID_DEFINITION,
      );
    throw error;
  }
  async create(actor: AuthPrincipal, input: unknown) {
    this.requireAdmin(actor);
    const value = parsePromotionRequest(promotionDefinitionWriteSchema, input);
    requireHomepageMedia(value.display.showOnHomepage);
    try {
      return await this.repository.transaction(async (tx) => {
        if (!(await this.repository.validateTargets(tx, value.rules)))
          throw new AppError(
            "Promotion target does not exist",
            400,
            PROMOTION_ERROR_CODES.INVALID_DEFINITION,
          );
        const row = await this.repository.insert(tx, {
          ...definitionToValues(value),
          definitionVersion: PROMOTION_DEFINITION_INITIAL_VERSION,
        });
        await this.repository.replaceRules(tx, row.id, value.rules);
        const dto = await this.dto(row, tx);
        await this.audit.write({
          tx,
          actor,
          storeId: null,
          action: PROMOTION_AUDIT_ACTIONS.CREATE,
          resourceType: "promotion",
          resourceId: row.id,
          after: auditState(dto),
        });
        return dto;
      });
    } catch (error) {
      return this.mapDatabaseFailure(error);
    }
  }
  async update(actor: AuthPrincipal, id: number, input: unknown) {
    this.requireAdmin(actor);
    const value = parsePromotionRequest(promotionUpdateRequestSchema, input);
    try {
      return await this.repository.transaction(async (tx) => {
        const current = await this.repository.find(id, tx, true);
        if (!current) throw notFound();
        if (current.definitionVersion !== value.expectedDefinitionVersion)
          throw new AppError(
            "Promotion has changed; reload before editing",
            409,
            PROMOTION_ERROR_CODES.VERSION_CONFLICT,
          );
        requireHomepageMedia(value.display.showOnHomepage, current);
        const related = await this.repository.related([id], undefined, tx);
        const usage = related.usage.get(id) ?? emptyPromotionUsage;
        const before = toPromotionAdminDto(
          current,
          related.rules,
          usage,
          this.clock(),
        );
        if (
          value.limits.globalRedemptions !== null &&
          BigInt(value.limits.globalRedemptions) < BigInt(usage.redemptions)
        )
          throw new AppError(
            "Limit is below occupied capacity",
            409,
            PROMOTION_ERROR_CODES.CAPACITY_EXHAUSTED,
          );
        if (
          value.limits.budgetPaise !== null &&
          BigInt(value.limits.budgetPaise) < BigInt(usage.budgetPaise)
        )
          throw new AppError(
            "Budget is below reserved and consumed savings",
            409,
            PROMOTION_ERROR_CODES.BUDGET_EXHAUSTED,
          );
        if (!(await this.repository.validateTargets(tx, value.rules)))
          throw new AppError(
            "Promotion target does not exist",
            400,
            PROMOTION_ERROR_CODES.INVALID_DEFINITION,
          );
        const row = await this.repository.update(tx, id, {
          ...definitionToValues(value),
          definitionVersion: nextVersion(current.definitionVersion),
          updatedAt: this.clock(),
        });
        await this.repository.replaceRules(tx, id, value.rules);
        const dto = await this.dto(row, tx);
        const action =
          current.isActive === row.isActive
            ? PROMOTION_AUDIT_ACTIONS.UPDATE
            : row.isActive
              ? PROMOTION_AUDIT_ACTIONS.REACTIVATE
              : PROMOTION_AUDIT_ACTIONS.DEACTIVATE;
        await this.audit.write({
          tx,
          actor,
          storeId: null,
          action,
          resourceType: "promotion",
          resourceId: id,
          before: auditState(before),
          after: auditState(dto),
        });
        return dto;
      });
    } catch (error) {
      return this.mapDatabaseFailure(error);
    }
  }
  async deactivate(actor: AuthPrincipal, id: number) {
    this.requireAdmin(actor);
    return this.repository.transaction(async (tx) => {
      const current = await this.repository.find(id, tx, true);
      if (!current) throw notFound();
      const before = await this.dto(current, tx);
      const row = current.isActive
        ? await this.repository.update(tx, id, {
            isActive: false,
            definitionVersion: nextVersion(current.definitionVersion),
            updatedAt: this.clock(),
          })
        : current;
      const dto = await this.dto(row, tx);
      await this.audit.write({
        tx,
        actor,
        storeId: null,
        action: PROMOTION_AUDIT_ACTIONS.DEACTIVATE,
        resourceType: "promotion",
        resourceId: id,
        before: auditState(before),
        after: auditState(dto),
      });
      return dto;
    });
  }
  async get(actor: AuthPrincipal, id: number) {
    this.requireAdmin(actor);
    const row = await this.repository.find(id);
    if (!row) throw notFound();
    return this.dto(row);
  }
  async list(actor: AuthPrincipal, input: unknown) {
    this.requireAdmin(actor);
    return this.listDefinitions(
      parsePromotionRequest(promotionListQuerySchema, input),
    );
  }
  private async listDefinitions(
    query: ReturnType<typeof promotionListQuerySchema.parse>,
    effective = false,
  ) {
    if (query.storeId !== undefined) await this.requireStore(query.storeId);
    const now = this.clock();
    const { rows, totalItems } = await this.repository.page(query, now);
    const related = await this.repository.related(
      rows.map((row) => row.id),
      query.storeId,
    );
    const rulesById = new Map<number, RuleRow[]>();
    for (const rule of related.rules) {
      const rules = rulesById.get(rule.promotionId) ?? [];
      rules.push(rule);
      rulesById.set(rule.promotionId, rules);
    }
    const settingsById = new Map(
      related.settings.map((setting) => [setting.promotionId, setting]),
    );
    return {
      items: rows.map((row) => {
        const rules = rulesById.get(row.id) ?? [];
        const usage = related.usage.get(row.id) ?? emptyPromotionUsage;
        if (effective && query.storeId !== undefined)
          return toEffectiveStoreDto(
            row,
            rules,
            usage,
            now,
            query.storeId,
            settingsById.get(row.id),
          );
        const dto = toPromotionAdminDto(row, rules, usage, now);
        return query.storeId === undefined
          ? dto
          : {
              ...dto,
              storeParticipation: {
                storeId: query.storeId,
                enabled: settingsById.get(row.id)?.isEnabled ?? true,
                effectiveEnabled:
                  row.isActive && (settingsById.get(row.id)?.isEnabled ?? true),
              },
            };
      }),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    };
  }
  async listStore(actor: AuthPrincipal, storeId: number, input: unknown) {
    await this.requireManager(actor, storeId);
    const query = parsePromotionRequest(promotionListQuerySchema, input);
    if (query.storeId !== undefined && query.storeId !== storeId)
      throw permissionDenied();
    return this.listDefinitions({ ...query, storeId }, true);
  }
  async setStoreEnabled(
    actor: AuthPrincipal,
    storeId: number,
    id: number,
    input: unknown,
  ) {
    await this.requireManager(actor, storeId);
    if (
      input &&
      typeof input === "object" &&
      "enabled" in input &&
      input.enabled === false &&
      !("reason" in input)
    )
      throw new AppError(
        "A disable reason is required",
        400,
        PROMOTION_ERROR_CODES.STORE_REASON_REQUIRED,
      );
    const value = parsePromotionRequest(
      storePromotionSettingWriteSchema,
      input,
    );
    return this.repository.transaction(async (tx) => {
      await this.requireManager(actor, storeId, tx);
      // Relative checkout order: store -> promotion -> explicit setting. Store
      // locking serializes an absent/default-on setting against first opt-out.
      const store = await this.repository.store(storeId, tx, true);
      if (!store || !store.isActive)
        throw new AppError("Store not found", 404, "RESOURCE_NOT_FOUND");
      const row = await this.repository.find(id, tx, true);
      if (!row) throw notFound();
      const before = await this.repository.setting(storeId, id, tx);
      const setting = await this.repository.saveSetting(
        tx,
        storeId,
        id,
        actor.userId,
        value.enabled,
        value.reason ?? null,
        this.clock(),
      );
      const related = await this.repository.related([id], storeId, tx);
      const dto = toEffectiveStoreDto(
        row,
        related.rules,
        related.usage.get(id) ?? emptyPromotionUsage,
        this.clock(),
        storeId,
        setting,
      );
      await this.audit.write({
        tx,
        actor,
        storeId,
        action: PROMOTION_AUDIT_ACTIONS.STORE_SETTING,
        resourceType: "store_promotion_setting",
        resourceId: id,
        before: {
          enabled: before?.isEnabled ?? true,
          reason: before?.disabledReason ?? null,
        },
        after: {
          enabled: setting.isEnabled,
          reason: setting.disabledReason,
          effectiveEnabled: dto.effectiveEnabled,
        },
        metadata: { promotionId: id, definitionVersion: row.definitionVersion },
      });
      return dto;
    });
  }
  private async requireStore(storeId: number, requireActive = false) {
    const store = await this.repository.store(storeId);
    if (!store || (requireActive && !store.isActive))
      throw new AppError("Store not found", 404, "RESOURCE_NOT_FOUND");
    return store;
  }
  async offers(storeId: number, featured = false) {
    const store = await this.requireStore(storeId, true);
    const rows = await this.repository.discovery(
      storeId,
      this.clock(),
      featured,
    );
    const ruleRows = await this.repository.rules(
      rows.map(({ promotion }) => promotion.id),
    );
    const rulesById = new Map<number, RuleRow[]>();
    for (const rule of ruleRows) {
      const rules = rulesById.get(rule.promotionId) ?? [];
      rules.push(rule);
      rulesById.set(rule.promotionId, rules);
    }
    return rows
      .filter(
        ({ promotion }) =>
          promotion.kind === "offer" &&
          (!featured || (promotion.imageUrl && promotion.imageAlt?.trim())),
      )
      .map(({ promotion }) =>
        toPublicOfferDto(
          promotion,
          rulesById.get(promotion.id) ?? [],
          store.timezone,
        ),
      );
  }
  async getAnalytics(actor: AuthPrincipal, id: number, input: unknown) {
    this.requireAdmin(actor);
    if (!(await this.repository.find(id))) throw notFound();
    const query = parsePromotionRequest(promotionAnalyticsQuerySchema, input);
    if (query.storeId !== undefined) await this.requireStore(query.storeId);
    const rows = await this.analytics.aggregate(id, query);
    const total = rows.find((row) => row.storeId === null);
    if (!total) throw new Error("Analytics aggregate omitted totals");
    return {
      promotionId: id,
      fromBusinessDate: query.fromBusinessDate,
      toBusinessDate: query.toBusinessDate,
      totals: promotionAnalyticsTotalsSchema.parse(total),
      stores: rows.flatMap((row) => {
        if (row.storeId === null || row.storeName === null) return [];
        const metrics = promotionAnalyticsTotalsSchema.parse(row);
        return [
          {
            storeId: row.storeId,
            storeName: row.storeName,
            consumedApplications: metrics.consumedApplications,
            uniqueUsers: metrics.uniqueUsers,
            itemDiscountPaise: metrics.itemDiscountPaise,
            deliveryDiscountPaise: metrics.deliveryDiscountPaise,
            totalSavingsPaise: metrics.totalSavingsPaise,
            influencedOrderValuePaise: metrics.influencedOrderValuePaise,
            netRevenueReductionPaise: metrics.netRevenueReductionPaise,
          },
        ];
      }),
    };
  }
  async uploadImage(
    actor: AuthPrincipal,
    id: number,
    input: unknown,
    file?: PromotionMediaFile,
  ) {
    this.requireAdmin(actor);
    const metadata = parsePromotionRequest(
      promotionMediaMetadataSchema,
      input,
      PROMOTION_ERROR_CODES.MEDIA_INVALID,
    );
    if (!(await this.repository.find(id))) throw notFound();
    const decoded = await validatePromotionMedia(file, metadata.variant);
    let writtenUrl: string | undefined;
    const dto = await this.repository
      .transaction(async (tx) => {
        await this.repository.lockMedia(tx);
        const current = await this.repository.find(id, tx, true);
        if (!current) throw notFound();
        const url = await this.storage.put(decoded.buffer, decoded.extension);
        writtenUrl = url;
        const replacedUrl =
          metadata.variant === "desktop"
            ? current.imageUrl
            : current.mobileImageUrl;
        // Failure after the write leaves a young orphan for age-gated cleanup.
        const row = await this.repository.update(tx, id, {
          ...(metadata.variant === "desktop"
            ? { imageUrl: url }
            : { mobileImageUrl: url }),
          imageAlt: metadata.imageAlt,
          definitionVersion: nextVersion(current.definitionVersion),
          updatedAt: this.clock(),
        });
        await this.audit.write({
          tx,
          actor,
          storeId: null,
          action: PROMOTION_AUDIT_ACTIONS.MEDIA_UPLOAD,
          resourceType: "promotion",
          resourceId: id,
          before: {
            definitionVersion: current.definitionVersion,
            url: replacedUrl,
          },
          after: {
            definitionVersion: row.definitionVersion,
            url,
            variant: metadata.variant,
            imageAlt: metadata.imageAlt,
          },
        });
        return {
          promotionId: id,
          definitionVersion: row.definitionVersion,
          variant: metadata.variant,
          url,
          imageAlt: metadata.imageAlt,
          replacedUrl,
        };
      })
      .catch((error: unknown) => {
        if (writtenUrl) this.storage.reportCleanupFailure(writtenUrl);
        throw error;
      });
    if (dto.replacedUrl) await this.removeUnreferencedMedia(dto.replacedUrl);
    return dto;
  }
  async removeImage(
    actor: AuthPrincipal,
    id: number,
    variant: PromotionMediaVariant,
  ) {
    this.requireAdmin(actor);
    const result = await this.repository.transaction(async (tx) => {
      await this.repository.lockMedia(tx);
      const current = await this.repository.find(id, tx, true);
      if (!current) throw notFound();
      const removedUrl =
        variant === "desktop" ? current.imageUrl : current.mobileImageUrl;
      const imageUrl = variant === "desktop" ? null : current.imageUrl;
      const mobileImageUrl =
        variant === "mobile" ? null : current.mobileImageUrl;
      const row = removedUrl
        ? await this.repository.update(tx, id, {
            imageUrl,
            mobileImageUrl,
            imageAlt: imageUrl || mobileImageUrl ? current.imageAlt : null,
            showOnHomepage: imageUrl !== null && current.showOnHomepage,
            definitionVersion: nextVersion(current.definitionVersion),
            updatedAt: this.clock(),
          })
        : current;
      await this.audit.write({
        tx,
        actor,
        storeId: null,
        action: PROMOTION_AUDIT_ACTIONS.MEDIA_REMOVE,
        resourceType: "promotion",
        resourceId: id,
        before: {
          definitionVersion: current.definitionVersion,
          url: removedUrl,
        },
        after: { definitionVersion: row.definitionVersion, variant, url: null },
      });
      return { row, removedUrl };
    });
    if (result.removedUrl)
      await this.removeUnreferencedMedia(result.removedUrl);
    return this.dto(result.row);
  }
  private async removeUnreferencedMedia(url: string) {
    try {
      if (!(await this.repository.isMediaReferenced(url)))
        await this.storage.remove(url);
    } catch {
      this.storage.reportCleanupFailure(url);
    }
  }
  async cleanupMedia() {
    return this.repository.transaction(async (tx) => {
      await this.repository.lockMedia(tx);
      const rows = await this.repository.mediaReferences(tx);
      const references = new Set(
        rows.flatMap((row) =>
          [row.imageUrl, row.mobileImageUrl].filter(
            (url): url is string => url !== null,
          ),
        ),
      );
      return this.storage.cleanup(references, this.clock());
    });
  }
}
export default new PromotionService();
