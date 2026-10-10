import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  ilike,
  inArray,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../../db";
import {
  deliveryZonesTable,
  inventoryMovementsTable,
  inventoryReservationsTable,
  productsTable,
  storeProductsTable,
  storesTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import { generateSlug } from "../../utils";
import {
  deriveStockStatus,
  getAvailableQuantity,
} from "../inventory/inventory.logic";
import { formatStoreTime, isStoreOpen } from "./store-hours";
import type { AuthPrincipal } from "../auth/auth.types";
import defaultAuthorizationService, {
  AuthorizationService,
  permissionDenied,
} from "../access/access.service";
import defaultAuditService, { AuditService } from "../audit/audit.service";
import type { AuditWriter } from "../audit/audit.types";
import { initializeCheckoutPricing, readCheckoutPricing } from "./store-pricing-setup";

export class StoreService {
  constructor(
    private readonly authorizationService: AuthorizationService = defaultAuthorizationService,
    private readonly auditService: AuditWriter = defaultAuditService
  ) {}

  async createStore(
    data: Omit<typeof storesTable.$inferInsert, "slug"> & { slug?: string },
    actor?: AuthPrincipal
  ) {
    if (actor) {
      this.authorizationService.requirePlatformAdmin(
        actor,
        "platform.stores.create"
      );
    }

    const slug = data.slug
      ? generateSlug(data.slug)
      : generateSlug(data.name);

    const existing = await this.getStoreBySlug(slug);
    if (existing) {
      throw new AppError(`Store with slug '${slug}' already exists`, 409);
    }

    return db.transaction(async (tx) => {
      const [newStore] = await tx.insert(storesTable).values({ ...data, slug }).returning();
      await initializeCheckoutPricing(tx, newStore);
      return newStore;
    });
  }

  async getCheckoutPricing(storeId: number, actor?: AuthPrincipal) {
    this.authorizationService.requirePlatformAdmin(actor, "platform.stores.create");
    return db.transaction(async (tx) => {
      const [store] = await tx.select().from(storesTable).where(eq(storesTable.id, storeId)).for("update");
      if (!store) throw new AppError("Store not found", 404, "RESOURCE_NOT_FOUND");
      return readCheckoutPricing(tx, store);
    });
  }

  async initializeCheckoutPricing(storeId: number, actor?: AuthPrincipal) {
    this.authorizationService.requirePlatformAdmin(actor, "platform.stores.create");
    return db.transaction(async (tx) => {
      const [store] = await tx.select().from(storesTable).where(eq(storesTable.id, storeId)).for("update");
      if (!store) throw new AppError("Store not found", 404, "RESOURCE_NOT_FOUND");
      const now = new Date();
      const result = await initializeCheckoutPricing(tx, store, now);
      if (Object.values(result.initialized).some(Boolean)) await this.auditService.write({
        tx, actor, storeId, action: "store.checkout_pricing.initialized", resourceType: "store", resourceId: storeId,
        after: result,
      });
      return readCheckoutPricing(tx, store, now);
    });
  }

  async getStores({
    principal,
    page = 1,
    limit = 10,
    search,
    isActive,
  }: {
    principal?: AuthPrincipal;
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  } = {}) {
    const conditions = [];

    if (principal && principal.platformRole !== "admin") {
      const accessibleStoreIds =
        await this.authorizationService.getAccessibleStoreIds({
          principal,
          permission: "dashboard.operations.read",
        });

      if (accessibleStoreIds === "all") {
        // Platform admin access
      } else if (accessibleStoreIds.length === 0) {
        throw permissionDenied();
      } else {
        conditions.push(inArray(storesTable.id, accessibleStoreIds));
      }
    }

    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(storesTable.name, term),
          ilike(storesTable.city, term),
          ilike(storesTable.state, term),
          ilike(storesTable.pincode, term),
          ilike(storesTable.address, term)
        )
      );
    }

    if (typeof isActive === "boolean") {
      conditions.push(eq(storesTable.isActive, isActive));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(storesTable)
      .where(whereClause);

    const parsedTotal = Number(total);
    const parsedLimit = Math.max(1, limit);
    const parsedPage = Math.max(1, page);
    const offset = (parsedPage - 1) * parsedLimit;

    const stores = await db.query.storesTable.findMany({
      where: whereClause,
      limit: parsedLimit,
      offset,
      orderBy: desc(storesTable.createdAt),
    });

    return {
      stores,
      meta: {
        total: parsedTotal,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(parsedTotal / parsedLimit),
        hasNextPage: parsedPage * parsedLimit < parsedTotal,
      },
    };
  }

  async getAllStores() {
    return await db.query.storesTable.findMany({
      orderBy: desc(storesTable.createdAt),
    });
  }

  async getStoresSelect(principal?: AuthPrincipal) {
    const conditions = [eq(storesTable.isActive, true)];

    if (principal && principal.platformRole !== "admin") {
      const accessibleStoreIds =
        await this.authorizationService.getAccessibleStoreIds({
          principal,
          permission: "dashboard.operations.read",
        });

      if (accessibleStoreIds === "all") {
        // Platform admin access
      } else if (accessibleStoreIds.length === 0) {
        throw permissionDenied();
      } else {
        conditions.push(inArray(storesTable.id, accessibleStoreIds));
      }
    }

    const stores = await db.query.storesTable.findMany({
      where: and(...conditions),
      orderBy: asc(storesTable.name),
      columns: {
        id: true,
        name: true,
        city: true,
        pincode: true,
      },
    });

    return stores.map((s) => ({
      value: s.id.toString(),
      label: `${s.name} (${s.city} - ${s.pincode})`,
    }));
  }

  async getStoreById(id: number) {
    return await db.query.storesTable.findFirst({
      where: eq(storesTable.id, id),
    });
  }

  async getStoreBySlug(slug: string) {
    return await db.query.storesTable.findFirst({
      where: eq(storesTable.slug, slug),
    });
  }

  async resolveStore(pincode: string, date = new Date()) {
    const zones = await db.query.deliveryZonesTable.findMany({
      where: eq(deliveryZonesTable.pincode, pincode),
      orderBy: asc(deliveryZonesTable.storeId),
      with: {
        store: true,
      },
    });

    if (zones.length === 0) {
      throw new AppError("We don't deliver to this area yet", 404);
    }

    const activeStores = zones
      .map((zone) => zone.store)
      .filter((store) => store.isActive)
      .sort((first, second) => first.id - second.id);

    if (activeStores.length === 0) {
      throw new AppError("We don't deliver to this area yet", 404);
    }

    const store = activeStores.find((candidate) =>
      isStoreOpen(candidate.opensAt, candidate.closesAt, date)
    );

    if (!store) {
      throw new AppError(
        `Stores in your area are currently closed. Opens at ${formatStoreTime(activeStores[0].opensAt)} IST`,
        409
      );
    }

    return store;
  }

  async getStoreProducts(storeId: number, actor?: AuthPrincipal) {
    if (actor) {
      await this.authorizationService.requireStorePermission({
        principal: actor,
        storeId,
        permission: "store.products.read",
      });
    }

    const store = await this.getStoreById(storeId);
    if (!store) {
      throw new AppError("Store not found", 404);
    }

    const now = new Date();
    const activeReservationsSubquery = db
      .select({
        storeProductId: inventoryReservationsTable.storeProductId,
        reservedQuantity:
          sql<number>`COALESCE(SUM(${inventoryReservationsTable.quantity}), 0)`
            .mapWith(Number)
            .as("reserved_quantity"),
      })
      .from(inventoryReservationsTable)
      .where(
        and(
          eq(inventoryReservationsTable.status, "reserved"),
          gt(inventoryReservationsTable.expiresAt, now)
        )
      )
      .groupBy(inventoryReservationsTable.storeProductId)
      .as("active_reservations");

    const rows = await db
      .select({
        ...getTableColumns(storeProductsTable),
        reservedQuantity:
          sql<number>`COALESCE(${activeReservationsSubquery.reservedQuantity}, 0)`.mapWith(
            Number
          ),
        product: {
          id: productsTable.id,
          name: productsTable.name,
          slug: productsTable.slug,
          pricePaise: productsTable.pricePaise,
          image: productsTable.image,
          isAvailable: productsTable.isAvailable,
          categoryId: productsTable.categoryId,
        },
      })
      .from(storeProductsTable)
      .innerJoin(
        productsTable,
        eq(storeProductsTable.productId, productsTable.id)
      )
      .leftJoin(
        activeReservationsSubquery,
        eq(storeProductsTable.id, activeReservationsSubquery.storeProductId)
      )
      .where(eq(storeProductsTable.storeId, storeId))
      .orderBy(asc(productsTable.name));

    return rows.map((row) => {
      const isTracked = row.onHandQuantity !== null;
      const availableQuantity = isTracked
        ? getAvailableQuantity(row.onHandQuantity, row.reservedQuantity)
        : null;
      const stockStatus = deriveStockStatus(
        row.onHandQuantity,
        availableQuantity,
        row.lowStockThreshold
      );

      return {
        ...row,
        reservedQuantity: row.reservedQuantity,
        availableQuantity,
        stockStatus,
      };
    });
  }

  async mapStoreProducts(
    storeId: number,
    mappings: Array<{
      productId: number;
      pricePaise: number;
      isAvailable: boolean;
    }>,
    actor?: AuthPrincipal
  ) {
    if (actor) {
      await this.authorizationService.requireStorePermission({
        principal: actor,
        storeId,
        permission: "store.products.mapping.manage",
      });
    }

    return await db.transaction(async (tx) => {
      const [store] = await tx
        .select()
        .from(storesTable)
        .where(eq(storesTable.id, storeId))
        .for("update")
        .limit(1);

      if (!store) {
        throw new AppError("Store not found", 404);
      }

      const productIds = mappings.map((mapping) => mapping.productId);
      const existingProducts = await tx
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(inArray(productsTable.id, productIds));
      const existingProductIds = new Set(
        existingProducts.map((product) => product.id)
      );
      const missingProductIds = productIds.filter(
        (productId) => !existingProductIds.has(productId)
      );

      if (missingProductIds.length > 0) {
        throw new AppError(
          `Products not found: ${missingProductIds.join(", ")}`,
          404
        );
      }

      const inserted = await tx
        .insert(storeProductsTable)
        .values(mappings.map((mapping) => ({ storeId, ...mapping })))
        .onConflictDoUpdate({
          target: [storeProductsTable.storeId, storeProductsTable.productId],
          set: {
            pricePaise: sql`excluded.price_paise`,
            isAvailable: sql`excluded.is_available`,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (actor) {
        await this.auditService.write({
          tx,
          actor,
          storeId,
          action: "store.products.mapped",
          resourceType: "store_product",
          resourceId: storeId,
          metadata: {
            mappedCount: mappings.length,
            mappings: mappings.map((m) => ({
              productId: m.productId,
              pricePaise: m.pricePaise,
              isAvailable: m.isAvailable,
            })),
          },
        });
      }

      return inserted;
    });
  }

  async updateStoreProduct(
    storeId: number,
    productId: number,
    data: { pricePaise?: number; isAvailable?: boolean },
    actor?: AuthPrincipal
  ) {
    if (actor) {
      if (data.pricePaise !== undefined) {
        await this.authorizationService.requireStorePermission({
          principal: actor,
          storeId,
          permission: "store.products.price.update",
        });
      }
      if (data.isAvailable !== undefined) {
        await this.authorizationService.requireStorePermission({
          principal: actor,
          storeId,
          permission: "store.products.availability.update",
        });
      }
    }

    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(storeProductsTable)
        .where(
          and(
            eq(storeProductsTable.storeId, storeId),
            eq(storeProductsTable.productId, productId)
          )
        )
        .for("update")
        .limit(1);

      if (!existing) {
        throw new AppError("Store product mapping not found", 404);
      }

      const before = {
        pricePaise: existing.pricePaise,
        isAvailable: existing.isAvailable,
      };

      const [mapping] = await tx
        .update(storeProductsTable)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(storeProductsTable.id, existing.id))
        .returning();

      if (actor) {
        await this.auditService.write({
          tx,
          actor,
          storeId,
          action: "store.product.updated",
          resourceType: "store_product",
          resourceId: mapping.id,
          before,
          after: {
            pricePaise: mapping.pricePaise,
            isAvailable: mapping.isAvailable,
          },
          metadata: {
            productId,
          },
        });
      }

      return mapping;
    });
  }

  async deleteStoreProduct(
    storeId: number,
    productId: number,
    actor?: AuthPrincipal
  ) {
    if (actor) {
      await this.authorizationService.requireStorePermission({
        principal: actor,
        storeId,
        permission: "store.products.mapping.manage",
      });
    }

    return await db.transaction(async (tx) => {
      const [mapping] = await tx
        .select()
        .from(storeProductsTable)
        .where(
          and(
            eq(storeProductsTable.storeId, storeId),
            eq(storeProductsTable.productId, productId)
          )
        )
        .for("update")
        .limit(1);

      if (!mapping) {
        throw new AppError("Store product mapping not found", 404);
      }

      const [movement] = await tx
        .select({ id: inventoryMovementsTable.id })
        .from(inventoryMovementsTable)
        .where(eq(inventoryMovementsTable.storeProductId, mapping.id))
        .limit(1);
      const [reservation] = await tx
        .select({ id: inventoryReservationsTable.id })
        .from(inventoryReservationsTable)
        .where(eq(inventoryReservationsTable.storeProductId, mapping.id))
        .limit(1);

      if (movement || reservation) {
        const [updated] = await tx
          .update(storeProductsTable)
          .set({ isAvailable: false, updatedAt: new Date() })
          .where(eq(storeProductsTable.id, mapping.id))
          .returning();

        if (actor) {
          await this.auditService.write({
            tx,
            actor,
            storeId,
            action: "store.product.removed",
            resourceType: "store_product",
            resourceId: mapping.id,
            metadata: {
              productId,
              removal: "soft",
            },
          });
        }

        return { ...updated, removal: "soft" as const };
      }

      const [deleted] = await tx
        .delete(storeProductsTable)
        .where(eq(storeProductsTable.id, mapping.id))
        .returning();

      if (actor) {
        await this.auditService.write({
          tx,
          actor,
          storeId,
          action: "store.product.removed",
          resourceType: "store_product",
          resourceId: mapping.id,
          metadata: {
            productId,
            removal: "hard",
          },
        });
      }

      return { ...deleted, removal: "hard" as const };
    });
  }

  async getDeliveryZones(storeId: number, actor?: AuthPrincipal) {
    if (actor) {
      await this.authorizationService.requireStorePermission({
        principal: actor,
        storeId,
        permission: "store.delivery_zones.read",
      });
    }

    const store = await this.getStoreById(storeId);
    if (!store) {
      throw new AppError("Store not found", 404);
    }

    return await db.query.deliveryZonesTable.findMany({
      where: eq(deliveryZonesTable.storeId, storeId),
      orderBy: asc(deliveryZonesTable.pincode),
    });
  }

  async addDeliveryZones(
    storeId: number,
    pincodes: string[],
    actor?: AuthPrincipal
  ) {
    if (actor) {
      await this.authorizationService.requireStorePermission({
        principal: actor,
        storeId,
        permission: "store.delivery_zones.manage",
      });
    }

    return await db.transaction(async (tx) => {
      const [store] = await tx
        .select()
        .from(storesTable)
        .where(eq(storesTable.id, storeId))
        .for("update")
        .limit(1);

      if (!store) {
        throw new AppError("Store not found", 404);
      }

      const uniquePincodes = [
        ...new Set(pincodes.map((pincode) => pincode.trim())),
      ];
      const zones = await tx
        .insert(deliveryZonesTable)
        .values(uniquePincodes.map((pincode) => ({ storeId, pincode })))
        .onConflictDoNothing({
          target: [deliveryZonesTable.storeId, deliveryZonesTable.pincode],
        })
        .returning();

      const result = {
        zones,
        addedCount: zones.length,
        skippedCount: uniquePincodes.length - zones.length,
      };

      if (actor) {
        await this.auditService.write({
          tx,
          actor,
          storeId,
          action: "store.delivery_zones.added",
          resourceType: "delivery_zone",
          resourceId: storeId,
          metadata: {
            pincodes: uniquePincodes,
            addedCount: result.addedCount,
            skippedCount: result.skippedCount,
          },
        });
      }

      return result;
    });
  }

  async deleteDeliveryZone(
    storeId: number,
    zoneId: number,
    actor?: AuthPrincipal
  ) {
    if (actor) {
      await this.authorizationService.requireStorePermission({
        principal: actor,
        storeId,
        permission: "store.delivery_zones.manage",
      });
    }

    return await db.transaction(async (tx) => {
      const [zone] = await tx
        .delete(deliveryZonesTable)
        .where(
          and(
            eq(deliveryZonesTable.id, zoneId),
            eq(deliveryZonesTable.storeId, storeId)
          )
        )
        .returning();

      if (!zone) {
        throw new AppError("Delivery zone not found", 404);
      }

      if (actor) {
        await this.auditService.write({
          tx,
          actor,
          storeId,
          action: "store.delivery_zone.deleted",
          resourceType: "delivery_zone",
          resourceId: zoneId,
          metadata: {
            pincode: zone.pincode,
          },
        });
      }

      return zone;
    });
  }

  async updateStore(
    id: number,
    data: Partial<typeof storesTable.$inferInsert>,
    actor?: AuthPrincipal
  ) {
    if (actor) {
      if (actor.platformRole === "admin") {
        this.authorizationService.requirePlatformAdmin(actor);
      } else {
        await this.authorizationService.requireStorePermission({
          principal: actor,
          storeId: id,
          permission: "store.profile.update",
        });

        // Non-admin managers cannot modify platform-controlled fields (slug, isActive)
        if (data.slug !== undefined || data.isActive !== undefined) {
          throw permissionDenied();
        }
      }
    }

    return await db.transaction(async (tx) => {
      const [store] = await tx
        .select()
        .from(storesTable)
        .where(eq(storesTable.id, id))
        .for("update")
        .limit(1);

      if (!store) {
        throw new AppError("Store not found", 404);
      }

      let slugToUpdate: string | undefined;
      if (data.slug) {
        slugToUpdate = generateSlug(data.slug);
      }

      if (slugToUpdate && slugToUpdate !== store.slug) {
        const existing = await tx.query.storesTable.findFirst({
          where: and(
            eq(storesTable.slug, slugToUpdate),
            ne(storesTable.id, id)
          ),
        });
        if (existing) {
          throw new AppError(
            `Store with slug '${slugToUpdate}' already exists`,
            409
          );
        }
      }

      const before = {
        name: store.name,
        address: store.address,
        city: store.city,
        state: store.state,
        pincode: store.pincode,
        phone: store.phone,
        email: store.email,
        opensAt: store.opensAt,
        closesAt: store.closesAt,
        latitude: store.latitude,
        longitude: store.longitude,
        slug: store.slug,
        isActive: store.isActive,
      };

      const [updatedStore] = await tx
        .update(storesTable)
        .set({
          ...data,
          ...(slugToUpdate ? { slug: slugToUpdate } : {}),
          updatedAt: new Date(),
        })
        .where(eq(storesTable.id, id))
        .returning();

      if (actor) {
        const after = {
          name: updatedStore.name,
          address: updatedStore.address,
          city: updatedStore.city,
          state: updatedStore.state,
          pincode: updatedStore.pincode,
          phone: updatedStore.phone,
          email: updatedStore.email,
          opensAt: updatedStore.opensAt,
          closesAt: updatedStore.closesAt,
          latitude: updatedStore.latitude,
          longitude: updatedStore.longitude,
          slug: updatedStore.slug,
          isActive: updatedStore.isActive,
        };

        await this.auditService.write({
          tx,
          actor,
          storeId: id,
          action: "store.profile.updated",
          resourceType: "store",
          resourceId: id,
          before,
          after,
        });
      }

      return updatedStore;
    });
  }

  async deleteStore(
    id: number,
    { permanent = false }: { permanent?: boolean } = {},
    actor?: AuthPrincipal
  ) {
    if (actor) {
      this.authorizationService.requirePlatformAdmin(
        actor,
        "platform.stores.delete"
      );
    }

    const store = await this.getStoreById(id);
    if (!store) {
      throw new AppError("Store not found", 404);
    }

    if (permanent) {
      await db.delete(storesTable).where(eq(storesTable.id, id));
      return { message: "Store permanently deleted", id };
    }

    const [updated] = await db
      .update(storesTable)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(storesTable.id, id))
      .returning();

    return { message: "Store deactivated successfully", store: updated };
  }
}

export default new StoreService();
