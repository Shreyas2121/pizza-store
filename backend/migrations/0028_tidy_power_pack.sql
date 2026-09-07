ALTER TABLE "products" ADD COLUMN "price_paise" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "price_paise" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "customization_options" ADD COLUMN "price_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_item_customizations" ADD COLUMN "price_paise" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "price_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN "total_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "discount_rate_bps" integer;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "discount_amount_paise" integer;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "minimum_order_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "store_products" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "customization_options" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "cart_item_customizations" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "cart_items" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "cart" DROP COLUMN "total_price";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "discount_value";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "min_order_value";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_price_paise_nonnegative" CHECK ("products"."price_paise" >= 0);--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_price_paise_nonnegative" CHECK ("store_products"."price_paise" >= 0);--> statement-breakpoint
ALTER TABLE "customization_options" ADD CONSTRAINT "customization_options_price_paise_nonnegative" CHECK ("customization_options"."price_paise" >= 0);--> statement-breakpoint
ALTER TABLE "cart_item_customizations" ADD CONSTRAINT "cart_item_customizations_price_paise_nonnegative" CHECK ("cart_item_customizations"."price_paise" >= 0);--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_price_paise_nonnegative" CHECK ("cart_items"."price_paise" >= 0);--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_total_paise_nonnegative" CHECK ("cart"."total_paise" >= 0);--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_minimum_order_paise_nonnegative" CHECK ("coupons"."minimum_order_paise" >= 0);--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_discount_rate_bps_valid" CHECK ("coupons"."discount_rate_bps" is null or ("coupons"."discount_rate_bps" > 0 and "coupons"."discount_rate_bps" <= 10000));--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_discount_amount_paise_positive" CHECK ("coupons"."discount_amount_paise" is null or "coupons"."discount_amount_paise" > 0);--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_discount_value_matches_type" CHECK (("coupons"."discount_type" = 'percentage' and "coupons"."discount_rate_bps" is not null and "coupons"."discount_amount_paise" is null) or ("coupons"."discount_type" = 'fixed' and "coupons"."discount_amount_paise" is not null and "coupons"."discount_rate_bps" is null));