import { asc, desc, eq, getTableColumns, SQL } from "drizzle-orm";
import { db } from "../../db";
import {
  menuItemsMappingTable,
  menuItemsTable,
  productCustomizationGroupMappingTable,
  productsTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";

class ProductService {
  async createProduct(product: typeof productsTable.$inferInsert) {
    const existingProduct = await this.getProductBySlug(product.slug);

    if (existingProduct) {
      throw new AppError(
        `Product with slug ${product.slug} already exists`,
        401
      );
    }

    return await db.insert(productsTable).values(product).returning();
  }

  async getProductBySlug(slug: string) {
    return await db.query.productsTable.findFirst({
      where: eq(productsTable.slug, slug),
    });
  }

  async getProductById(id: number) {
    return await db.query.productsTable.findFirst({
      where: eq(productsTable.id, id),
    });
  }

  async getProductsByMenuSlug({
    menuSlug,
    limit = 10,
    offset = 0,
    sortBy = "default",
  }: {
    menuSlug: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
  }) {
    let order: SQL<unknown>;

    switch (sortBy) {
      case "default":
        order = desc(productsTable.createdAt);
        break;

      case "price_low":
        order = asc(productsTable.price);
        break;

      case "price_high":
        order = desc(productsTable.price);
        break;

      default:
        order = desc(productsTable.createdAt);
        break;
    }

    const res = await db
      .select({
        ...getTableColumns(productsTable),
      })
      .from(productsTable)
      .innerJoin(
        menuItemsMappingTable,
        eq(menuItemsMappingTable.productId, productsTable.id)
      )
      .innerJoin(
        menuItemsTable,
        eq(menuItemsTable.id, menuItemsMappingTable.menuItemId)
      )
      .where(eq(menuItemsTable.slug, menuSlug))
      .offset(offset)
      .limit(limit)
      .orderBy(order);

    return res;
  }

  async getProducts({
    limit = 10,
    offset = 0,
    sortBy = "default",
  }: {
    limit?: number;
    offset?: number;
    sortBy?: string;
  }) {
    let order: SQL<unknown>;

    switch (sortBy) {
      case "default":
        order = desc(productsTable.createdAt);
        break;

      case "price_low":
        order = asc(productsTable.price);
        break;

      case "price_high":
        order = desc(productsTable.price);
        break;

      default:
        order = desc(productsTable.createdAt);
        break;
    }

    return await db.query.productsTable.findMany({
      offset,
      limit,
      orderBy: order,
    });
  }

  async getProductsA() {
    return await db.query.productsTable.findMany({
      orderBy: desc(productsTable.createdAt),
      with: {
        category: {
          columns: {
            name: true,
          },
        },
      },
    });
  }

  async getProductsByCategory(categoryId: number) {
    return await db.query.productsTable.findMany({
      where: eq(productsTable.categoryId, categoryId),
    });
  }

  async getProductsByGroupId(groupId: number) {
    return await db.query.productCustomizationGroupMappingTable.findMany({
      where: eq(productCustomizationGroupMappingTable.groupId, groupId),
      with: {
        product: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getNoCustomizeProducts() {
    return await db.query.productsTable.findMany({
      where: eq(productsTable.hasCustomization, false),
    });
  }
}

export default new ProductService();
