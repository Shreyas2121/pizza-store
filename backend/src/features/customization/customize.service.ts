import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  customizationGroupsTable,
  customizationOptionsTable,
  productCustomizationGroupMappingTable,
  productsTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import { validateCustomizationSelection } from "./customize.logic";

class CustomizeService {
  async createCustomizationGroup(
    data: typeof customizationGroupsTable.$inferInsert
  ) {
    return await db.insert(customizationGroupsTable).values(data).returning();
  }

  async createCustomizationOption(
    data: typeof customizationOptionsTable.$inferInsert
  ) {
    const group = await db.query.customizationGroupsTable.findFirst({ where: eq(customizationGroupsTable.id, data.groupId), columns: { id: true } });
    if (!group) throw new AppError("Customization group not found", 404);
    return await db.insert(customizationOptionsTable).values(data).returning();
  }

  async createProductCustomizationGroupMapping(
    data: typeof productCustomizationGroupMappingTable.$inferInsert
  ) {
    return await db.insert(productCustomizationGroupMappingTable).values(data);
  }

  async replaceProductCustomizationGroupMappings(groupId: number, productIds: number[]) {
    return await db.transaction(async (tx) => {
      const [group] = await tx.select({ id: customizationGroupsTable.id }).from(customizationGroupsTable).where(eq(customizationGroupsTable.id, groupId)).for("update");
      if (!group) throw new AppError("Customization group not found", 404);
      const previous = await tx.select({ productId: productCustomizationGroupMappingTable.productId }).from(productCustomizationGroupMappingTable).where(eq(productCustomizationGroupMappingTable.groupId, groupId));
      const affectedIds = [...new Set([...previous.map((row) => row.productId), ...productIds])];
      if (affectedIds.length) {
        const products = await tx.select({ id: productsTable.id, productType: productsTable.productType }).from(productsTable).where(inArray(productsTable.id, affectedIds)).orderBy(asc(productsTable.id)).for("update");
        if (productIds.some((id) => !products.some((product) => product.id === id))) throw new AppError("Product not found", 404);
        if (products.some((product) => productIds.includes(product.id) && product.productType === "bundle")) throw new AppError("Bundles cannot have customization groups", 400);
      }
      await tx
        .delete(productCustomizationGroupMappingTable)
        .where(eq(productCustomizationGroupMappingTable.groupId, groupId));

      if (productIds.length) {
        await tx.insert(productCustomizationGroupMappingTable).values(
          productIds.map((productId) => ({ productId, groupId }))
        );
      }
      if (affectedIds.length) {
        await tx.update(productsTable).set({
          hasCustomization: sql`exists (select 1 from ${productCustomizationGroupMappingTable} where ${productCustomizationGroupMappingTable.productId} = ${productsTable.id})`,
          updatedAt: new Date(),
        }).where(inArray(productsTable.id, affectedIds));
      }
    });
  }

  async getCustomizationOptionById(id: number) {
    return await db.query.customizationOptionsTable.findFirst({
      where: eq(customizationOptionsTable.id, id),
    });
  }

  async validateProductSelection(productId: number, ids: number[], tx?: TransactionType) {
    const mappings = await this.getCustomizationByProductId(productId, tx);
    validateCustomizationSelection(mappings.map((mapping) => mapping.group), ids);
  }

  async getCustomizationByProductId(productId: number, tx?: TransactionType) {
    return await (tx ?? db).query.productCustomizationGroupMappingTable.findMany({
      where: eq(productCustomizationGroupMappingTable.productId, productId),
      columns: {
        productId: false,
        groupId: false,
      },
      with: {
        group: {
          with: {
            options: true,
          },
        },
      },
    });
  }

  async getAllCustomizationGroups() {
    return await db.query.customizationGroupsTable.findMany({
      with: {
        options: true,
        mapping: {
          with: {
            product: true,
          },
        },
      },
    });
  }
}

export default new CustomizeService();
