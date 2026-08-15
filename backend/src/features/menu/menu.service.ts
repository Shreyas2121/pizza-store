import { asc, eq } from "drizzle-orm";
import { db } from "../../db";
import { menuItemsMappingTable, menuItemsTable } from "../../db/schema";
import { AppError } from "../../utils/error";

class MenuItemService {
  async createenuItem(data: typeof menuItemsTable.$inferInsert) {
    const existingItem = await this.existingPostion(data.position);

    if (existingItem) {
      throw new AppError(
        `Menu item with position ${data.position} already exists`,
        401
      );
    }

    return await db.insert(menuItemsTable).values(data).returning();
  }

  async existingPostion(position: number) {
    const item = await db.query.menuItemsTable.findFirst({
      where: eq(menuItemsTable.position, position),
    });
    return item;
  }

  async getAllMenuItems() {
    return await db.query.menuItemsTable.findMany({
      orderBy: asc(menuItemsTable.position),
    });
  }

  async createMenuItemsMapping(
    data: typeof menuItemsMappingTable.$inferInsert
  ) {
    return await db.insert(menuItemsMappingTable).values(data).returning();
  }
}

export default new MenuItemService();
