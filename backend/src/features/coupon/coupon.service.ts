import { eq } from "drizzle-orm";
import { db } from "../../db";
import { couponsTable } from "../../db/schema";

class CouponService {
  async createCoupon(data: typeof couponsTable.$inferInsert) {
    return await db
      .insert(couponsTable)
      .values({
        ...data,
      })
      .returning();
  }

  async getCoupons() {
    return await db.query.couponsTable.findMany({});
  }

  async getCouponById(id: number) {
    return await db.query.couponsTable.findFirst({
      where: eq(couponsTable.id, id),
    });
  }

  async getCouponByCode(code: string) {
    return await db.query.couponsTable.findFirst({
      where: eq(couponsTable.code, code),
    });
  }

  async updateCoupon(
    id: number,
    data: Partial<typeof couponsTable.$inferInsert>
  ) {
    await db.update(couponsTable).set(data).where(eq(couponsTable.id, id));
  }

  async deleteCoupon(id: number) {
    await db.delete(couponsTable).where(eq(couponsTable.id, id));
  }
}

export default new CouponService();
