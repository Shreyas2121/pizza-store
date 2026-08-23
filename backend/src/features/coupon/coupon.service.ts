import { eq } from "drizzle-orm";
import { db } from "../../db";
import { couponsTable } from "../../db/schema";
import { AppError } from "../../utils/error";

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

  async validateCoupon({ code, total }: { code: string; total: number }) {
    const coupon = await this.getCouponByCode(code);

    if (!coupon) {
      throw new AppError("Coupon not found", 404);
    }

    const now = new Date();

    if (!coupon.isActive) {
      throw new AppError("Coupon is not active", 400);
    }

    if (now < coupon.startDate || now > coupon.endDate) {
      throw new AppError("Coupon is expired or not yet valid", 400);
    }

    if (
      coupon.maxRedemptions >= 0 &&
      coupon.redemptionCount >= coupon.maxRedemptions
    ) {
      throw new AppError("Coupon maximum redemption limit reached", 400);
    }

    if (total < coupon.minOrderValue) {
      throw new AppError(
        `Minimum order value of ${coupon.minOrderValue} not met`,
        400
      );
    }

    return coupon;
  }
}

export default new CouponService();
