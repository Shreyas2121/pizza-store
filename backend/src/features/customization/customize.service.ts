import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  customizationGroupsTable,
  customizationOptionsTable,
  productCustomizationGroupMappingTable,
} from "../../db/schema";

class CustomizeService {
  async createCustomizationGroup(
    data: typeof customizationGroupsTable.$inferInsert
  ) {
    return await db.insert(customizationGroupsTable).values(data).returning();
  }

  async createCustomizationOption(
    data: typeof customizationOptionsTable.$inferInsert
  ) {
    return await db.insert(customizationOptionsTable).values(data).returning();
  }

  async createProductCustomizationGroupMapping(
    data: typeof productCustomizationGroupMappingTable.$inferInsert
  ) {
    return await db.insert(productCustomizationGroupMappingTable).values(data);
  }

  async getCustomizationOptionById(id: number) {
    return await db.query.customizationOptionsTable.findFirst({
      where: eq(customizationOptionsTable.id, id),
    });
  }

  async getCustomizationByProductId(productId: number) {
    return await db.query.productCustomizationGroupMappingTable.findMany({
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
