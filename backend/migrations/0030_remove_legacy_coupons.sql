ALTER TABLE "orders" DROP CONSTRAINT "orders_coupon_id_coupons_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "coupon_id";
--> statement-breakpoint
DROP TABLE "coupon_redemptions";
--> statement-breakpoint
DROP TABLE "coupons";
