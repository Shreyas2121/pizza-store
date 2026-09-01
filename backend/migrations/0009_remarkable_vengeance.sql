ALTER TABLE "order_item_customizations" DROP CONSTRAINT "order_item_customizations_snapshot_complete";--> statement-breakpoint
ALTER TABLE "order_item_customizations" DROP CONSTRAINT "order_item_customizations_name_present";--> statement-breakpoint
ALTER TABLE "order_item_customizations" DROP CONSTRAINT "order_item_customizations_price_nonnegative";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_price_snapshot_complete";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_snapshot_name_present";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_price_amounts_nonnegative";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_tax_rate_valid";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_subtotal_reconciles";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_discount_within_subtotal";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_line_total_reconciles";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_inclusive_tax_reconciles";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_exact_snapshot_complete";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_exact_amounts_nonnegative";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_discount_within_subtotal";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_grand_total_reconciles";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_inclusive_tax_reconciles";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_currency_inr";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_quote_version_present";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_pricing_policy_version_positive";--> statement-breakpoint
ALTER TABLE "order_item_customizations" ALTER COLUMN "customization_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_item_customizations" ALTER COLUMN "price_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "line_subtotal_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "discount_allocation_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "tax_rate_bps" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "taxable_amount_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "tax_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "line_total_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "items_subtotal_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_fee_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "taxable_amount_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "tax_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "rounding_adjustment_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "grand_total_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "quote_version" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "pricing_policy_version" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_item_customizations" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "discount_amount";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "total_price";--> statement-breakpoint
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_name_present" CHECK (nullif(btrim("order_item_customizations"."customization_name"), '') is not null);--> statement-breakpoint
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_price_nonnegative" CHECK ("order_item_customizations"."price_paise" >= 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_snapshot_name_present" CHECK (nullif(btrim("order_items"."product_name"), '') is not null);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_price_amounts_nonnegative" CHECK ("order_items"."unit_price_paise" >= 0
        and "order_items"."line_subtotal_paise" >= 0
        and "order_items"."discount_allocation_paise" >= 0
        and "order_items"."taxable_amount_paise" >= 0
        and "order_items"."tax_paise" >= 0
        and "order_items"."line_total_paise" >= 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tax_rate_valid" CHECK ("order_items"."tax_rate_bps" between 0 and 10000);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_subtotal_reconciles" CHECK ("order_items"."line_subtotal_paise"::bigint =
        "order_items"."unit_price_paise"::bigint * "order_items"."quantity"::bigint);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_discount_within_subtotal" CHECK ("order_items"."discount_allocation_paise" <= "order_items"."line_subtotal_paise");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_line_total_reconciles" CHECK ("order_items"."line_total_paise"::bigint =
        "order_items"."line_subtotal_paise"::bigint - "order_items"."discount_allocation_paise"::bigint);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_inclusive_tax_reconciles" CHECK ("order_items"."taxable_amount_paise"::bigint + "order_items"."tax_paise"::bigint = "order_items"."line_total_paise"::bigint);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_exact_amounts_nonnegative" CHECK ("orders"."items_subtotal_paise" >= 0
        and "orders"."discount_paise" >= 0
        and "orders"."delivery_fee_paise" >= 0
        and "orders"."taxable_amount_paise" >= 0
        and "orders"."tax_paise" >= 0
        and "orders"."grand_total_paise" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_within_subtotal" CHECK ("orders"."discount_paise" <= "orders"."items_subtotal_paise");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_grand_total_reconciles" CHECK ("orders"."grand_total_paise"::bigint =
        "orders"."items_subtotal_paise"::bigint - "orders"."discount_paise"::bigint
        + "orders"."delivery_fee_paise"::bigint + "orders"."rounding_adjustment_paise"::bigint);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_inclusive_tax_reconciles" CHECK ("orders"."taxable_amount_paise"::bigint + "orders"."tax_paise"::bigint =
        "orders"."items_subtotal_paise"::bigint - "orders"."discount_paise"::bigint
        + "orders"."delivery_fee_paise"::bigint);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_inr" CHECK ("orders"."currency" = 'INR');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_version_present" CHECK (nullif(btrim("orders"."quote_version"), '') is not null);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pricing_policy_version_positive" CHECK ("orders"."pricing_policy_version" > 0);