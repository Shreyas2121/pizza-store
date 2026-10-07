import express from "express";
import type { Server } from "node:http";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransactionType } from "../../utils/types";
import type { AuthPrincipal } from "../auth/auth.types";
import authenticationService from "../auth/auth.service";
import authorizationService, {
  AuthorizationService,
} from "../access/access.service";
import type { MembershipAccessRecord } from "../access/access.types";
import auditService from "../audit/audit.service";
import { handleErrorWithAudit } from "../../utils/error";
import { PromotionRepository } from "./promotion.repository";
import { PromotionService } from "./promotion.service";
import { PromotionMediaStorage } from "./promotion-media.storage";
import { PromotionAnalyticsRepository } from "./promotion-analytics.repository";
import { createPromotionRoutes } from "./promotion.routes";
import {
  definitionToValues,
  definitionFromRows,
  promotionStatus,
  rulesToValues,
  toEffectiveStoreDto,
  toPromotionRecord,
  toPublicOfferDto,
  type PromotionRow,
  type SettingRow,
} from "./promotion.mapper";
import {
  promotionAnalyticsQuerySchema,
  promotionDefinitionWriteSchema,
  promotionListQuerySchema,
} from "./promotion.schemas";

const now = new Date("2026-10-06T06:00:00Z");
const admin: AuthPrincipal = {
  userId: 1,
  email: "admin@example.test",
  platformRole: "admin",
  tokenVersion: 0,
};
const manager: AuthPrincipal = {
  userId: 2,
  email: "manager@example.test",
  platformRole: "user",
  tokenVersion: 0,
};
const definition = promotionDefinitionWriteSchema.parse({
  kind: "offer",
  name: "Pizza offer",
  description: "Save on pizza",
  code: null,
  discount: { type: "percentage", rateBps: 2000, maxDiscountPaise: null },
  scope: "cart",
  includeCustomizationValue: false,
  eligibility: {
    minimumOrderPaise: 0,
    minimumCartQuantity: 0,
    firstOrderOnly: false,
  },
  validity: {
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-11-01T00:00:00.000Z",
    activeDaysOfWeek: null,
    activeStartTime: null,
    activeEndTime: null,
  },
  limits: {
    perUserRedemptions: null,
    globalRedemptions: null,
    budgetPaise: null,
  },
  display: { priority: 5, showOnHomepage: false },
  rules: [],
  isActive: true,
});
const promotion = (changes: Partial<PromotionRow> = {}): PromotionRow => ({
  id: 10,
  definitionVersion: 1,
  kind: "offer",
  name: definition.name,
  description: definition.description,
  code: null,
  discountType: "percentage",
  discountRateBps: 2000,
  discountAmountPaise: null,
  maxDiscountPaise: null,
  scope: "cart",
  includeCustomizationValue: false,
  minimumOrderPaise: 0,
  minimumCartQuantity: 0,
  firstOrderOnly: false,
  startsAt: new Date(definition.validity.startsAt),
  endsAt: new Date(definition.validity.endsAt),
  activeDaysOfWeek: null,
  activeStartTime: null,
  activeEndTime: null,
  perUserRedemptionLimit: null,
  maxRedemptions: null,
  totalDiscountBudgetPaise: null,
  displayPriority: 5,
  imageUrl: null,
  mobileImageUrl: null,
  imageAlt: null,
  showOnHomepage: false,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  ...changes,
});
const setting: SettingRow = {
  id: 90,
  promotionId: 10,
  storeId: 1,
  isEnabled: false,
  disabledReason: "Unavailable stock",
  updatedByUserId: 2,
  createdAt: now,
  updatedAt: now,
};
const member = (
  role: MembershipAccessRecord["role"] = "manager",
  storeId = 1,
): MembershipAccessRecord => ({
  membershipId: 1,
  userId: 2,
  storeId,
  role,
  status: "active",
  storeIsActive: true,
  storeName: "Store",
  storeSlug: "store",
});
const usage = { redemptions: "0", budgetPaise: "0" };

const harness = (membership: MembershipAccessRecord | undefined = member()) => {
  const repository = new PromotionRepository();
  const storage = new PromotionMediaStorage();
  const analytics = new PromotionAnalyticsRepository();
  const authorization = new AuthorizationService(
    {
      findMembership: vi.fn(async ({ storeId }) =>
        membership?.storeId === storeId ? membership : undefined,
      ),
      listMemberships: vi.fn(async () => (membership ? [membership] : [])),
    },
    { warn: vi.fn() },
  );
  const audit = { write: vi.fn().mockResolvedValue(undefined) };
  let row = promotion();
  // A transaction token passed to stubbed repository operations; no DB methods run.
  const tx = {} as TransactionType;
  vi.spyOn(repository, "transaction").mockImplementation(async (operation) =>
    operation(tx),
  );
  vi.spyOn(repository, "find").mockImplementation(async () => row);
  vi.spyOn(repository, "insert").mockImplementation(async (_tx, value) => {
    row = { ...row, ...value };
    return row;
  });
  vi.spyOn(repository, "update").mockImplementation(async (_tx, _id, value) => {
    row = { ...row, ...value };
    return row;
  });
  vi.spyOn(repository, "replaceRules").mockResolvedValue();
  vi.spyOn(repository, "rules").mockResolvedValue([]);
  vi.spyOn(repository, "validateTargets").mockResolvedValue(true);
  vi.spyOn(repository, "related").mockResolvedValue({
    rules: [],
    settings: [],
    usage: new Map([[10, usage]]),
  });
  vi.spyOn(repository, "store").mockResolvedValue({
    id: 1,
    name: "Store",
    slug: "store",
    address: "Address",
    city: "City",
    state: "Karnataka",
    pincode: "560001",
    phone: "123",
    email: null,
    latitude: null,
    longitude: null,
    opensAt: "09:00",
    closesAt: "23:00",
    timezone: "Asia/Kolkata",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  vi.spyOn(repository, "setting").mockResolvedValue(undefined);
  vi.spyOn(repository, "saveSetting").mockImplementation(
    async (
      _tx,
      storeId,
      promotionId,
      updatedByUserId,
      isEnabled,
      disabledReason,
    ) => ({
      ...setting,
      storeId,
      promotionId,
      updatedByUserId,
      isEnabled,
      disabledReason,
    }),
  );
  vi.spyOn(repository, "lockMedia").mockResolvedValue();
  vi.spyOn(repository, "isMediaReferenced").mockResolvedValue(false);
  vi.spyOn(storage, "put").mockResolvedValue(
    "/uploads/promotions/00000000-0000-4000-8000-000000000002.png",
  );
  vi.spyOn(storage, "remove").mockResolvedValue();
  vi.spyOn(storage, "reportCleanupFailure").mockImplementation(() => {});
  return {
    repository,
    storage,
    analytics,
    authorization,
    audit,
    tx,
    service: new PromotionService(
      repository,
      authorization,
      audit,
      storage,
      analytics,
      () => now,
    ),
    setRow: (value: PromotionRow) => {
      row = value;
    },
  };
};
beforeEach(() => vi.restoreAllMocks());

describe("promotion governance", () => {
  it("normalizes manual coupon codes while retaining admin-only visibility", async () => {
    const h = harness();
    const dto = await h.service.create(admin, {
      ...definition,
      kind: "coupon",
      code: " save10 ",
    });
    expect(dto).toMatchObject({ kind: "coupon", code: "SAVE10" });
    expect(h.repository.insert).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({ code: "SAVE10" }),
    );
    expect(h.audit.write.mock.calls[0][0].after).not.toHaveProperty("code");
  });
  it("batches list dependencies and shows default-on store participation", async () => {
    const h = harness();
    vi.spyOn(h.repository, "page").mockResolvedValue({
      rows: [promotion(), promotion({ id: 11 })],
      totalItems: 2,
    });
    const dto = await h.service.list(admin, { storeId: 1, pageSize: 2 });
    expect(dto).toMatchObject({
      page: 1,
      pageSize: 2,
      totalItems: 2,
      totalPages: 1,
    });
    expect(dto.items[0]).toMatchObject({
      storeParticipation: { storeId: 1, enabled: true, effectiveEnabled: true },
    });
    expect(h.repository.related).toHaveBeenCalledExactlyOnceWith([10, 11], 1);
    const managerDto = await h.service.listStore(manager, 1, {});
    expect(managerDto.items[0]).toMatchObject({
      storeId: 1,
      effectiveEnabled: true,
      explicitSetting: null,
    });
  });
  it("allows historical admin reads for inactive stores while rejecting public discovery", async () => {
    const h = harness();
    const store = await h.repository.store(1);
    if (!store) throw new Error("Missing store fixture");
    vi.mocked(h.repository.store).mockResolvedValue({
      ...store,
      isActive: false,
    });
    vi.spyOn(h.repository, "page").mockResolvedValue({
      rows: [promotion()],
      totalItems: 1,
    });
    expect((await h.service.list(admin, { storeId: 1 })).items).toHaveLength(1);
    await expect(h.service.offers(1)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });
  it("creates a global definition and audits its version in the transaction", async () => {
    const h = harness();
    const dto = await h.service.create(admin, definition);
    expect(dto).toMatchObject({
      id: 10,
      definitionVersion: 1,
      status: "active",
    });
    expect(h.repository.insert).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({ kind: "offer", definitionVersion: 1 }),
    );
    expect(h.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: h.tx,
        storeId: null,
        action: "promotion.created",
        after: expect.objectContaining({ definitionVersion: 1 }),
      }),
    );
    expect(h.audit.write.mock.calls[0][0].after).not.toHaveProperty("code");
  });
  it("validates targets and desktop media before admitting invalid definitions", async () => {
    const h = harness();
    vi.mocked(h.repository.validateTargets).mockResolvedValue(false);
    await expect(h.service.create(admin, definition)).rejects.toMatchObject({
      code: "PROMOTION_INVALID_DEFINITION",
    });
    await expect(
      h.service.create(admin, {
        ...definition,
        display: { priority: 1, showOnHomepage: true },
      }),
    ).rejects.toMatchObject({ code: "PROMOTION_MEDIA_REQUIRED_FOR_HOMEPAGE" });
    expect(h.repository.insert).not.toHaveBeenCalled();
  });
  it("rejects stale edits, unsafe integers and unknown fields", async () => {
    const h = harness();
    await expect(
      h.service.update(admin, 10, {
        ...definition,
        expectedDefinitionVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "PROMOTION_VERSION_CONFLICT" });
    await expect(
      h.service.create(admin, { ...definition, storeId: 1 }),
    ).rejects.toMatchObject({ code: "PROMOTION_INVALID_DEFINITION" });
    expect(
      promotionListQuerySchema.safeParse({ page: Number.MAX_SAFE_INTEGER })
        .success,
    ).toBe(false);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...definition,
        display: { priority: Number.MAX_SAFE_INTEGER, showOnHomepage: false },
      }).success,
    ).toBe(false);
    expect(h.repository.update).not.toHaveBeenCalled();
  });
  it.each(["budget", "capacity"])(
    "refuses reductions below reserved-plus-consumed %s",
    async (kind) => {
      const h = harness();
      vi.mocked(h.repository.related).mockResolvedValue({
        rules: [],
        settings: [],
        usage: new Map([[10, { budgetPaise: "10000", redemptions: "4" }]]),
      });
      const limits = {
        ...definition.limits,
        ...(kind === "budget"
          ? { budgetPaise: 9999 }
          : { globalRedemptions: 3 }),
      };
      await expect(
        h.service.update(admin, 10, {
          ...definition,
          limits,
          expectedDefinitionVersion: 1,
        }),
      ).rejects.toMatchObject({
        code:
          kind === "budget"
            ? "PROMOTION_BUDGET_EXHAUSTED"
            : "PROMOTION_CAPACITY_EXHAUSTED",
      });
      expect(h.repository.update).not.toHaveBeenCalled();
    },
  );
  it("increments versions on deactivation/reactivation and leaves store settings intact", async () => {
    const h = harness();
    expect((await h.service.deactivate(admin, 10)).definitionVersion).toBe(2);
    expect((await h.service.deactivate(admin, 10)).definitionVersion).toBe(2);
    const dto = await h.service.update(admin, 10, {
      ...definition,
      expectedDefinitionVersion: 2,
    });
    expect(dto.definitionVersion).toBe(3);
    expect(dto.isActive).toBe(true);
    expect(h.repository.saveSetting).not.toHaveBeenCalled();
    expect(h.audit.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "promotion.reactivated" }),
    );
  });
  it("only allows same-store managers to toggle; locks store before promotion and setting", async () => {
    const h = harness();
    const dto = await h.service.setStoreEnabled(manager, 1, 10, {
      enabled: false,
      reason: "Unavailable stock",
    });
    expect(dto).toMatchObject({
      effectiveEnabled: false,
      effectiveStatus: "store_disabled",
    });
    const storeLock = vi.mocked(h.repository.store).mock.invocationCallOrder[0];
    expect(storeLock).toBeLessThan(
      vi.mocked(h.repository.find).mock.invocationCallOrder[0],
    );
    expect(
      vi.mocked(h.repository.find).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(h.repository.setting).mock.invocationCallOrder[0]);
    expect(h.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 1,
        resourceType: "store_promotion_setting",
        metadata: { promotionId: 10, definitionVersion: 1 },
      }),
    );
    await expect(
      h.service.setStoreEnabled(manager, 2, 10, { enabled: true }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(
      h.service.setStoreEnabled(admin, 1, 10, { enabled: true }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(h.repository.saveSetting).toHaveBeenCalledOnce();
  });
  it.each([
    "finance_manager",
    "payroll_manager",
    "operator",
    "inventory_staff",
  ] as const)("denies %s definition, media and store changes", async (role) => {
    const h = harness(member(role));
    await expect(h.service.create(manager, definition)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
    await expect(
      h.service.uploadImage(manager, 10, {}, undefined),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(
      h.service.setStoreEnabled(manager, 1, 10, { enabled: true }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(h.repository.transaction).not.toHaveBeenCalled();
  });
  it("denies customers and rechecks membership in the write transaction", async () => {
    const h = harness();
    vi.spyOn(h.authorization, "requireStorePermission")
      .mockResolvedValueOnce({
        access: "membership",
        userId: 2,
        storeId: 1,
        membershipRole: "manager",
        permission: "store.promotions.toggle",
      })
      .mockRejectedValueOnce(new Error("revoked"));
    await expect(
      h.service.setStoreEnabled(manager, 1, 10, { enabled: true }),
    ).rejects.toThrow("revoked");
    expect(h.repository.saveSetting).not.toHaveBeenCalled();
    const customer = harness();
    vi.spyOn(
      customer.authorization,
      "requireStorePermission",
    ).mockRejectedValue(new Error("no membership"));
    await expect(customer.service.listStore(manager, 1, {})).rejects.toThrow(
      "no membership",
    );
  });
  it("requires a bounded disable reason and rejects cross-store query overrides", async () => {
    const h = harness();
    await expect(
      h.service.setStoreEnabled(manager, 1, 10, { enabled: false }),
    ).rejects.toMatchObject({ code: "STORE_PROMOTION_REASON_REQUIRED" });
    await expect(
      h.service.listStore(manager, 1, { storeId: 2 }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });
  it("reports exact aggregate strings and distinct platform users without summing store user counts", async () => {
    const h = harness();
    const metrics = {
      reservedApplications: "1",
      consumedApplications: "2",
      releasedApplications: "1",
      uniqueUsers: "1",
      itemDiscountPaise: "4294967294",
      deliveryDiscountPaise: "0",
      totalSavingsPaise: "4294967294",
      influencedOrderValuePaise: "9999999999",
      netRevenueReductionPaise: "4000000000",
    };
    vi.spyOn(h.analytics, "aggregate").mockResolvedValue([
      { ...metrics, storeId: null, storeName: null },
      { ...metrics, storeId: 1, storeName: "Store 1", consumedApplications: "1", itemDiscountPaise: "2147483647", totalSavingsPaise: "2147483647", influencedOrderValuePaise: "4999999999", netRevenueReductionPaise: "2000000000" },
      { ...metrics, storeId: 2, storeName: "Store 2", consumedApplications: "1", itemDiscountPaise: "2147483647", totalSavingsPaise: "2147483647", influencedOrderValuePaise: "5000000000", netRevenueReductionPaise: "2000000000" },
    ]);
    const dto = await h.service.getAnalytics(admin, 10, {});
    expect(dto.totals.uniqueUsers).toBe("1");
    expect(dto.totals.itemDiscountPaise).toBe("4294967294");
    expect(dto.stores[0]).not.toHaveProperty("reservedApplications");
    for (const metric of ["consumedApplications", "itemDiscountPaise", "deliveryDiscountPaise", "totalSavingsPaise", "influencedOrderValuePaise", "netRevenueReductionPaise"] as const) {
      expect(dto.stores.reduce((sum, store) => sum + BigInt(store[metric]), 0n)).toBe(BigInt(dto.totals[metric]));
    }
    expect(
      promotionAnalyticsQuerySchema.safeParse({
        fromBusinessDate: "2026-10-02",
        toBusinessDate: "2026-10-01",
      }).success,
    ).toBe(false);
  });
});

describe("promotion DTO boundaries", () => {
  it("uses half-open dates and capacity-derived status without altering isActive", () => {
    expect(
      promotionStatus(
        promotion(),
        usage,
        new Date(definition.validity.startsAt),
      ),
    ).toBe("active");
    expect(
      promotionStatus(promotion(), usage, new Date(definition.validity.endsAt)),
    ).toBe("expired");
    expect(
      promotionStatus(
        promotion({ maxRedemptions: 1 }),
        { ...usage, redemptions: "1" },
        now,
      ),
    ).toBe("exhausted");
    expect(
      promotionStatus(
        promotion({ totalDiscountBudgetPaise: 1000 }),
        { ...usage, budgetPaise: "1000" },
        now,
      ),
    ).toBe("exhausted");
    expect(promotionStatus(promotion({ isActive: false }), usage, now)).toBe(
      "inactive",
    );
  });
  it("defaults to enabled and preserves explicit opt-out through global reactivation", () => {
    expect(
      toEffectiveStoreDto(promotion(), [], usage, now, 1).effectiveEnabled,
    ).toBe(true);
    expect(
      toEffectiveStoreDto(
        promotion({ isActive: false }),
        [],
        usage,
        now,
        1,
        setting,
      ).effectiveStatus,
    ).toBe("globally_inactive");
    expect(
      toEffectiveStoreDto(promotion(), [], usage, now, 1, setting)
        .effectiveStatus,
    ).toBe("store_disabled");
    expect(
      toEffectiveStoreDto(promotion(), [], usage, now, 2).effectiveEnabled,
    ).toBe(true);
  });
  it("keeps coupons out of public DTOs and maps complete rule types round-trip", () => {
    expect(() =>
      toPublicOfferDto(
        promotion({ kind: "coupon", code: "HIDDEN" }),
        [],
        "Asia/Kolkata",
      ),
    ).toThrow();
    const dto = toPublicOfferDto(promotion(), [], "Asia/Kolkata");
    expect(dto).not.toHaveProperty("code");
    expect(dto).not.toHaveProperty("limits");
    expect(dto).not.toHaveProperty("status");
    const bxgy = {
      ...definition,
      discount: { type: "buy_x_get_y" as const },
      scope: "product" as const,
      rules: [
        {
          type: "buy_x_get_y" as const,
          buyQuantity: 2,
          getQuantity: 1,
          buyProductIds: [1, 2],
          buyCategoryIds: [3],
          getProductIds: [4],
          getCategoryIds: [5],
        },
      ],
    };
    const values = definitionToValues(bxgy);
    const ruleRows = rulesToValues(10, bxgy.rules).map((r, index) => ({
      id: index + 1,
      productId: null,
      categoryId: null,
      quantity: null,
      tierMinPaise: null,
      tierDiscountType: null,
      tierDiscountRateBps: null,
      tierDiscountAmountPaise: null,
      tierMaxDiscountPaise: null,
      createdAt: now,
      ...r,
    }));
    const row = promotion({ ...values });
    expect(definitionFromRows(row, ruleRows).rules).toEqual(bxgy.rules);
    expect(toPromotionRecord(row, ruleRows).discount.type).toBe("buy_x_get_y");
  });
});

describe("promotion media transaction sequencing", () => {
  const imageFile = async () => {
    const buffer = await sharp({
      create: { width: 1200, height: 400, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    return {
      buffer,
      size: buffer.length,
      mimetype: "image/png",
      originalname: "banner.png",
    };
  };
  it("removes replaced media only after the reference and audit commit", async () => {
    const h = harness();
    const old = "/uploads/promotions/00000000-0000-4000-8000-000000000001.png";
    h.setRow(promotion({ imageUrl: old, imageAlt: "Old" }));
    const events: string[] = [];
    vi.mocked(h.repository.transaction).mockImplementation(
      async (operation) => {
        const result = await operation(h.tx);
        events.push("commit");
        return result;
      },
    );
    vi.mocked(h.storage.remove).mockImplementation(async () => {
      events.push("remove");
    });
    const dto = await h.service.uploadImage(
      admin,
      10,
      { variant: "desktop", imageAlt: "New" },
      await imageFile(),
    );
    expect(events).toEqual(["commit", "remove"]);
    expect(dto.replacedUrl).toBe(old);
    expect(dto.definitionVersion).toBe(2);
    expect(h.repository.update).toHaveBeenCalledWith(
      h.tx,
      10,
      expect.objectContaining({ imageAlt: "New" }),
    );
  });
  it("leaves the old asset intact on DB failure and records the new orphan for cleanup", async () => {
    const h = harness();
    vi.mocked(h.repository.update).mockRejectedValue(new Error("DB failed"));
    await expect(
      h.service.uploadImage(
        admin,
        10,
        { variant: "desktop", imageAlt: "New" },
        await imageFile(),
      ),
    ).rejects.toThrow("DB failed");
    expect(h.storage.remove).not.toHaveBeenCalled();
    expect(h.storage.reportCleanupFailure).toHaveBeenCalledOnce();
  });
  it("returns committed truth when old-file cleanup fails and protects referenced assets", async () => {
    const h = harness();
    h.setRow(
      promotion({
        imageUrl:
          "/uploads/promotions/00000000-0000-4000-8000-000000000001.png",
        imageAlt: "Old",
      }),
    );
    vi.mocked(h.storage.remove).mockRejectedValue(new Error("filesystem busy"));
    expect(
      (
        await h.service.uploadImage(
          admin,
          10,
          { variant: "desktop", imageAlt: "New" },
          await imageFile(),
        )
      ).definitionVersion,
    ).toBe(2);
    expect(h.storage.reportCleanupFailure).toHaveBeenCalledOnce();
    vi.mocked(h.repository.isMediaReferenced).mockResolvedValue(true);
    vi.mocked(h.storage.remove).mockClear();
    await h.service.removeImage(admin, 10, "desktop");
    expect(h.storage.remove).not.toHaveBeenCalled();
  });
  it("removing featured desktop media disables placement and retains mobile alt text", async () => {
    const h = harness();
    h.setRow(
      promotion({
        imageUrl:
          "/uploads/promotions/00000000-0000-4000-8000-000000000001.png",
        mobileImageUrl:
          "/uploads/promotions/00000000-0000-4000-8000-000000000002.png",
        imageAlt: "Offer",
        showOnHomepage: true,
      }),
    );
    const dto = await h.service.removeImage(admin, 10, "desktop");
    expect(dto.display).toMatchObject({
      imageUrl: null,
      imageAlt: "Offer",
      showOnHomepage: false,
    });
  });
});

describe("promotion HTTP authorization and auditing", () => {
  const servers: Server[] = [];
  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map(
          (server) =>
            new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            ),
        ),
    );
  });
  const request = async (
    h: ReturnType<typeof harness>,
    url: string,
    init?: RequestInit,
    principal = admin,
  ) => {
    vi.spyOn(authenticationService, "authenticateToken").mockResolvedValue(
      principal,
    );
    vi.spyOn(authorizationService, "requireStorePermission").mockImplementation(
      (input) => h.authorization.requireStorePermission(input),
    );
    vi.spyOn(auditService, "writeAttempt").mockResolvedValue();
    const app = express();
    app.use(express.json());
    const routes = createPromotionRoutes(h.service);
    app.use("/promotions", routes.promotions);
    app.use("/stores", routes.stores);
    app.use(
      (
        error: unknown,
        req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        void handleErrorWithAudit(error, req, res);
      },
    );
    const server = app.listen(0);
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No port");
    return fetch(`http://127.0.0.1:${address.port}${url}`, init);
  };
  const json = (body: unknown, method = "POST") => ({
    method,
    headers: {
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  it("permits admin creation and records successful audit evidence", async () => {
    const h = harness();
    const response = await request(h, "/promotions", json(definition));
    expect(response.status).toBe(201);
    expect(h.audit.write).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      data: { id: 10, definitionVersion: 1 },
    });
  });
  it("accepts one valid multipart image and returns only committed application URLs", async () => {
    const h = harness();
    const buffer = await sharp({
      create: { width: 1200, height: 400, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.append("variant", "desktop");
    form.append("imageAlt", "Pizza offer");
    form.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: "image/png" }),
      "banner.png",
    );
    const response = await request(h, "/promotions/10/images", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: form,
    });
    expect(response.status).toBe(200);
    const dto = await response.json();
    expect(dto.data).toMatchObject({
      promotionId: 10,
      definitionVersion: 2,
      variant: "desktop",
      imageAlt: "Pizza offer",
      replacedUrl: null,
    });
    expect(dto.data.url).toMatch(/^\/uploads\/promotions\//);
    expect(h.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "promotion.media_uploaded" }),
    );
  });
  it("rejects extra multipart fields and multiple file parts before persistence", async () => {
    const h = harness();
    for (const extraFile of [false, true]) {
      const form = new FormData();
      form.append("variant", "desktop");
      form.append("imageAlt", "Offer");
      form.append(
        "file",
        new Blob(["bytes"], { type: "image/png" }),
        "banner.png",
      );
      if (extraFile)
        form.append(
          "file",
          new Blob(["bytes"], { type: "image/png" }),
          "other.png",
        );
      else form.append("storagePath", "../../private");
      const response = await request(h, "/promotions/10/images", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: form,
      });
      expect(response.status).toBe(400);
      expect(auditService.writeAttempt).toHaveBeenLastCalledWith(
        expect.objectContaining({ reasonCode: "PROMOTION_MEDIA_INVALID" }),
      );
    }
    expect(h.storage.put).not.toHaveBeenCalled();
  });
  it.each(["POST", "PUT", "DELETE"])(
    "audits denied %s definition mutations without hidden code payloads",
    async (method) => {
      const h = harness();
      const response = await request(
        h,
        method === "POST" ? "/promotions" : "/promotions/10",
        json({ ...definition, code: "PRIVATE" }, method),
        manager,
      );
      expect(response.status).toBe(403);
      expect(auditService.writeAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: "denied",
          reasonCode: "PERMISSION_DENIED",
          resourceType: "promotion",
        }),
      );
      expect(
        JSON.stringify(vi.mocked(auditService.writeAttempt).mock.calls),
      ).not.toContain("PRIVATE");
    },
  );
  it("audits missing authentication and validation failures", async () => {
    const h = harness();
    const unauthorized = await request(h, "/promotions", { method: "POST" });
    expect(unauthorized.status).toBe(401);
    expect(auditService.writeAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        outcome: "denied",
        reasonCode: "AUTH_TOKEN_MISSING",
      }),
    );
    const invalid = await request(h, "/promotions", json({ kind: "unknown" }));
    expect(invalid.status).toBe(400);
    expect(auditService.writeAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        outcome: "failure",
        reasonCode: "PROMOTION_INVALID_DEFINITION",
      }),
    );
  });
  it("audits cross-store toggle denial and allows the manager's own store", async () => {
    const h = harness();
    const denied = await request(
      h,
      "/stores/2/promotions/10/setting",
      json({ enabled: true }, "PUT"),
      manager,
    );
    expect(denied.status).toBe(403);
    expect(auditService.writeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 2,
        operation: "promotion.store_setting_update",
        outcome: "denied",
      }),
    );
    const allowed = await request(
      h,
      "/stores/1/promotions/10/setting",
      json({ enabled: false, reason: "Stock" }, "PUT"),
      manager,
    );
    expect(allowed.status).toBe(200);
    expect(h.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 1,
        action: "store_promotion_setting.updated",
      }),
    );
  });
  it("serves public offers without coupon or administrative metadata", async () => {
    const h = harness();
    vi.spyOn(h.repository, "discovery").mockResolvedValue([
      { promotion: promotion() },
      { promotion: promotion({ kind: "coupon", code: "HIDDEN" }) },
    ]);
    const response = await request(h, "/promotions/offers?storeId=1");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("HIDDEN");
    expect(body.data[0]).not.toHaveProperty("code");
    expect(body.data[0]).not.toHaveProperty("limits");
  });
  it("rejects non-admin image uploads before parsing bytes and audits malformed uploads", async () => {
    const h = harness();
    const denied = await request(
      h,
      "/promotions/10/images",
      json({}, "POST"),
      manager,
    );
    expect(denied.status).toBe(403);
    const form = new FormData();
    form.append("variant", "desktop");
    form.append("imageAlt", "Offer");
    form.append(
      "file",
      new Blob(["not an image"], { type: "image/png" }),
      "banner.png",
    );
    const invalid = await request(h, "/promotions/10/images", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: form,
    });
    expect(invalid.status).toBe(400);
    expect(auditService.writeAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operation: "promotion.media_upload",
        outcome: "failure",
        reasonCode: "PROMOTION_MEDIA_INVALID",
      }),
    );
    expect(h.storage.put).not.toHaveBeenCalled();
  });
});
