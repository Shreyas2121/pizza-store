import { and, asc, count, desc, eq, ilike, ne, or } from "drizzle-orm";
import { db } from "../../db";
import { deliveryZonesTable, storesTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import { generateSlug } from "../../utils";

class StoreService {
  async createStore(
    data: Omit<typeof storesTable.$inferInsert, "slug"> & { slug?: string }
  ) {
    const slug = data.slug
      ? generateSlug(data.slug)
      : generateSlug(data.name);

    const existing = await this.getStoreBySlug(slug);
    if (existing) {
      throw new AppError(`Store with slug '${slug}' already exists`, 409);
    }

    const [newStore] = await db
      .insert(storesTable)
      .values({
        ...data,
        slug,
      })
      .returning();

    return newStore;
  }

  async getStores({
    page = 1,
    limit = 10,
    search,
    isActive,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  } = {}) {
    const conditions = [];

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

  async getStoresSelect() {
    const stores = await db.query.storesTable.findMany({
      where: eq(storesTable.isActive, true),
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

  async getDeliveryZones(storeId: number) {
    const store = await this.getStoreById(storeId);
    if (!store) {
      throw new AppError("Store not found", 404);
    }

    return await db.query.deliveryZonesTable.findMany({
      where: eq(deliveryZonesTable.storeId, storeId),
      orderBy: asc(deliveryZonesTable.pincode),
    });
  }

  async addDeliveryZones(storeId: number, pincodes: string[]) {
    const store = await this.getStoreById(storeId);
    if (!store) {
      throw new AppError("Store not found", 404);
    }

    const uniquePincodes = [...new Set(pincodes.map((pincode) => pincode.trim()))];
    const zones = await db
      .insert(deliveryZonesTable)
      .values(uniquePincodes.map((pincode) => ({ storeId, pincode })))
      .onConflictDoNothing({
        target: [deliveryZonesTable.storeId, deliveryZonesTable.pincode],
      })
      .returning();

    return {
      zones,
      addedCount: zones.length,
      skippedCount: uniquePincodes.length - zones.length,
    };
  }

  async deleteDeliveryZone(storeId: number, zoneId: number) {
    const store = await this.getStoreById(storeId);
    if (!store) {
      throw new AppError("Store not found", 404);
    }

    const [zone] = await db
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

    return zone;
  }

  async updateStore(
    id: number,
    data: Partial<typeof storesTable.$inferInsert>
  ) {
    const store = await this.getStoreById(id);
    if (!store) {
      throw new AppError("Store not found", 404);
    }

    let slugToUpdate: string | undefined;
    if (data.slug) {
      slugToUpdate = generateSlug(data.slug);
    } else if (data.name && data.name !== store.name && !data.slug) {
      // If name changed and no slug provided, we can keep the old slug or let it be.
      // Keeping old slug prevents breaking URLs unless slug is explicitly provided.
    }

    if (slugToUpdate && slugToUpdate !== store.slug) {
      const existing = await db.query.storesTable.findFirst({
        where: and(eq(storesTable.slug, slugToUpdate), ne(storesTable.id, id)),
      });
      if (existing) {
        throw new AppError(
          `Store with slug '${slugToUpdate}' already exists`,
          409
        );
      }
    }

    const [updatedStore] = await db
      .update(storesTable)
      .set({
        ...data,
        ...(slugToUpdate ? { slug: slugToUpdate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(storesTable.id, id))
      .returning();

    return updatedStore;
  }

  async deleteStore(
    id: number,
    { permanent = false }: { permanent?: boolean } = {}
  ) {
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
