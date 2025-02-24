import { eq } from "drizzle-orm";
import { db } from "../../db";
import { categoriesTable } from "../../db/schema";

class CategoryService {
  async createCategory(name: string) {
    return await db.insert(categoriesTable).values({ name }).returning();
  }

  async getAllCategories() {
    return await db.query.categoriesTable.findMany();
  }

  async getCategoryById(id: number) {
    return await db.query.categoriesTable.findFirst({
      where: eq(categoriesTable.id, id),
    });
  }
}

export default new CategoryService();
