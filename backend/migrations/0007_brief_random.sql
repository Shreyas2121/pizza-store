ALTER TABLE "order_item_customizations" ADD COLUMN "customization_name" text;--> statement-breakpoint
ALTER TABLE "order_item_customizations" ADD COLUMN "price_paise" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_name" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_price_paise" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "line_subtotal_paise" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "discount_allocation_paise" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_rate_bps" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "taxable_amount_paise" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_paise" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "line_total_paise" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_cost_paise" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "line_cost_paise" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "hsn_sac_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "items_subtotal_paise" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_paise" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_fee_paise" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "taxable_amount_paise" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_paise" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rounding_adjustment_paise" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "grand_total_paise" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quote_version" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pricing_policy_version" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "recognized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_snapshot_complete" CHECK (("order_item_customizations"."customization_name" is null and "order_item_customizations"."price_paise" is null)
        or ("order_item_customizations"."customization_name" is not null and "order_item_customizations"."price_paise" is not null));--> statement-breakpoint
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_name_present" CHECK ("order_item_customizations"."customization_name" is null or nullif(btrim("order_item_customizations"."customization_name"), '') is not null);--> statement-breakpoint
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_price_nonnegative" CHECK ("order_item_customizations"."price_paise" is null or "order_item_customizations"."price_paise" >= 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_price_snapshot_complete" CHECK ((
        "order_items"."product_name" is null
        and "order_items"."unit_price_paise" is null
        and "order_items"."line_subtotal_paise" is null
        and "order_items"."discount_allocation_paise" is null
        and "order_items"."tax_rate_bps" is null
        and "order_items"."taxable_amount_paise" is null
        and "order_items"."tax_paise" is null
        and "order_items"."line_total_paise" is null
      ) or (
        "order_items"."product_name" is not null
        and "order_items"."unit_price_paise" is not null
        and "order_items"."line_subtotal_paise" is not null
        and "order_items"."discount_allocation_paise" is not null
        and "order_items"."tax_rate_bps" is not null
        and "order_items"."taxable_amount_paise" is not null
        and "order_items"."tax_paise" is not null
        and "order_items"."line_total_paise" is not null
      ));--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_snapshot_name_present" CHECK ("order_items"."product_name" is null or nullif(btrim("order_items"."product_name"), '') is not null);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_price_amounts_nonnegative" CHECK ("order_items"."unit_price_paise" is null or (
        "order_items"."unit_price_paise" >= 0
        and "order_items"."line_subtotal_paise" >= 0
        and "order_items"."discount_allocation_paise" >= 0
        and "order_items"."taxable_amount_paise" >= 0
        and "order_items"."tax_paise" >= 0
        and "order_items"."line_total_paise" >= 0
      ));--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tax_rate_valid" CHECK ("order_items"."tax_rate_bps" is null or "order_items"."tax_rate_bps" between 0 and 10000);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_subtotal_reconciles" CHECK ("order_items"."unit_price_paise" is null or "order_items"."line_subtotal_paise"::bigint =
        "order_items"."unit_price_paise"::bigint * "order_items"."quantity"::bigint);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_discount_within_subtotal" CHECK ("order_items"."unit_price_paise" is null or "order_items"."discount_allocation_paise" <= "order_items"."line_subtotal_paise");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_line_total_reconciles" CHECK ("order_items"."unit_price_paise" is null or "order_items"."line_total_paise"::bigint =
        "order_items"."line_subtotal_paise"::bigint - "order_items"."discount_allocation_paise"::bigint);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_inclusive_tax_reconciles" CHECK ("order_items"."unit_price_paise" is null or
        "order_items"."taxable_amount_paise"::bigint + "order_items"."tax_paise"::bigint = "order_items"."line_total_paise"::bigint);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_cost_snapshot_complete" CHECK (("order_items"."unit_cost_paise" is null and "order_items"."line_cost_paise" is null)
        or ("order_items"."unit_cost_paise" is not null and "order_items"."line_cost_paise" is not null));--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_cost_amounts_valid" CHECK ("order_items"."unit_cost_paise" is null or (
        "order_items"."unit_cost_paise" >= 0
        and "order_items"."line_cost_paise"::bigint = "order_items"."unit_cost_paise"::bigint * "order_items"."quantity"::bigint
      ));--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_hsn_sac_code_present" CHECK ("order_items"."hsn_sac_code" is null or nullif(btrim("order_items"."hsn_sac_code"), '') is not null);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_exact_snapshot_complete" CHECK ((
        "orders"."items_subtotal_paise" is null
        and "orders"."discount_paise" is null
        and "orders"."delivery_fee_paise" is null
        and "orders"."taxable_amount_paise" is null
        and "orders"."tax_paise" is null
        and "orders"."rounding_adjustment_paise" is null
        and "orders"."grand_total_paise" is null
        and "orders"."currency" is null
        and "orders"."quote_version" is null
        and "orders"."pricing_policy_version" is null
      ) or (
        "orders"."items_subtotal_paise" is not null
        and "orders"."discount_paise" is not null
        and "orders"."delivery_fee_paise" is not null
        and "orders"."taxable_amount_paise" is not null
        and "orders"."tax_paise" is not null
        and "orders"."rounding_adjustment_paise" is not null
        and "orders"."grand_total_paise" is not null
        and "orders"."currency" is not null
        and "orders"."quote_version" is not null
        and "orders"."pricing_policy_version" is not null
      ));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_exact_amounts_nonnegative" CHECK ("orders"."items_subtotal_paise" is null or (
        "orders"."items_subtotal_paise" >= 0
        and "orders"."discount_paise" >= 0
        and "orders"."delivery_fee_paise" >= 0
        and "orders"."taxable_amount_paise" >= 0
        and "orders"."tax_paise" >= 0
        and "orders"."grand_total_paise" >= 0
      ));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_within_subtotal" CHECK ("orders"."items_subtotal_paise" is null or "orders"."discount_paise" <= "orders"."items_subtotal_paise");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_grand_total_reconciles" CHECK ("orders"."items_subtotal_paise" is null or "orders"."grand_total_paise"::bigint =
        "orders"."items_subtotal_paise"::bigint - "orders"."discount_paise"::bigint
        + "orders"."delivery_fee_paise"::bigint + "orders"."rounding_adjustment_paise"::bigint);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_inclusive_tax_reconciles" CHECK ("orders"."items_subtotal_paise" is null or
        "orders"."taxable_amount_paise"::bigint + "orders"."tax_paise"::bigint =
        "orders"."items_subtotal_paise"::bigint - "orders"."discount_paise"::bigint
        + "orders"."delivery_fee_paise"::bigint);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_inr" CHECK ("orders"."currency" is null or "orders"."currency" = 'INR');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_version_present" CHECK ("orders"."quote_version" is null or nullif(btrim("orders"."quote_version"), '') is not null);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pricing_policy_version_positive" CHECK ("orders"."pricing_policy_version" is null or "orders"."pricing_policy_version" > 0);