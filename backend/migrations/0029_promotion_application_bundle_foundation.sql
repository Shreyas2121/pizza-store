CREATE TABLE "promotions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promotions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"code" text,
	"discount_type" text NOT NULL,
	"discount_rate_bps" integer,
	"discount_amount_paise" integer,
	"max_discount_paise" integer,
	"minimum_order_paise" integer DEFAULT 0 NOT NULL,
	"minimum_cart_quantity" integer DEFAULT 0 NOT NULL,
	"scope" text NOT NULL,
	"include_customization_value" boolean DEFAULT false NOT NULL,
	"definition_version" integer DEFAULT 1 NOT NULL,
	"first_order_only" boolean DEFAULT false NOT NULL,
	"per_user_redemption_limit" integer,
	"active_start_time" time,
	"active_end_time" time,
	"active_days_of_week" integer[],
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"max_redemptions" integer,
	"total_discount_budget_paise" integer,
	"display_priority" integer DEFAULT 0 NOT NULL,
	"image_url" text,
	"mobile_image_url" text,
	"image_alt" text,
	"show_on_homepage" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_kind_valid" CHECK ("promotions"."kind" in ('offer', 'coupon')),
	CONSTRAINT "promotions_name_description_valid" CHECK (nullif(btrim("promotions"."name"), '') is not null
        and char_length("promotions"."name") <= 120
        and nullif(btrim("promotions"."description"), '') is not null
        and char_length("promotions"."description") <= 1000),
	CONSTRAINT "promotions_kind_code_consistency" CHECK (("promotions"."kind" = 'offer' and "promotions"."code" is null)
        or ("promotions"."kind" = 'coupon'
          and nullif(btrim("promotions"."code"), '') is not null
          and "promotions"."code" = upper(btrim("promotions"."code"))
          and char_length("promotions"."code") <= 64)),
	CONSTRAINT "promotions_discount_type_valid" CHECK ("promotions"."discount_type" in ('percentage', 'fixed_amount', 'buy_x_get_y', 'free_delivery', 'tiered')),
	CONSTRAINT "promotions_scope_valid" CHECK ("promotions"."scope" in ('cart', 'product', 'category', 'delivery')),
	CONSTRAINT "promotions_kind_type_scope_valid" CHECK (("promotions"."kind" = 'coupon'
          and "promotions"."discount_type" in ('percentage', 'fixed_amount', 'tiered')
          and "promotions"."scope" = 'cart')
        or ("promotions"."kind" = 'offer' and (
          ("promotions"."discount_type" in ('percentage', 'fixed_amount')
            and "promotions"."scope" in ('cart', 'product', 'category'))
          or ("promotions"."discount_type" = 'buy_x_get_y'
            and "promotions"."scope" in ('product', 'category'))
          or ("promotions"."discount_type" = 'free_delivery' and "promotions"."scope" = 'delivery')
          or ("promotions"."discount_type" = 'tiered' and "promotions"."scope" = 'cart')
        ))),
	CONSTRAINT "promotions_discount_value_matches_type" CHECK (("promotions"."discount_type" = 'percentage'
          and "promotions"."discount_rate_bps" between 1 and 10000
          and "promotions"."discount_amount_paise" is null)
        or ("promotions"."discount_type" = 'fixed_amount'
          and "promotions"."discount_rate_bps" is null
          and "promotions"."discount_amount_paise" > 0)
        or ("promotions"."discount_type" in ('buy_x_get_y', 'free_delivery', 'tiered')
          and "promotions"."discount_rate_bps" is null
          and "promotions"."discount_amount_paise" is null)),
	CONSTRAINT "promotions_max_discount_valid" CHECK (("promotions"."discount_type" = 'percentage'
          and ("promotions"."max_discount_paise" is null or "promotions"."max_discount_paise" > 0))
        or ("promotions"."discount_type" <> 'percentage' and "promotions"."max_discount_paise" is null)),
	CONSTRAINT "promotions_customization_value_valid" CHECK ("promotions"."include_customization_value" = false
        or "promotions"."discount_type" in ('percentage', 'fixed_amount', 'tiered')),
	CONSTRAINT "promotions_eligibility_amounts_valid" CHECK ("promotions"."minimum_order_paise" >= 0 and "promotions"."minimum_cart_quantity" >= 0),
	CONSTRAINT "promotions_limits_valid" CHECK (("promotions"."per_user_redemption_limit" is null or "promotions"."per_user_redemption_limit" > 0)
        and ("promotions"."max_redemptions" is null or "promotions"."max_redemptions" > 0)
        and ("promotions"."total_discount_budget_paise" is null or "promotions"."total_discount_budget_paise" > 0)),
	CONSTRAINT "promotions_definition_version_positive" CHECK ("promotions"."definition_version" > 0),
	CONSTRAINT "promotions_validity_range_valid" CHECK ("promotions"."ends_at" > "promotions"."starts_at"),
	CONSTRAINT "promotions_time_window_valid" CHECK (("promotions"."active_start_time" is null and "promotions"."active_end_time" is null)
        or ("promotions"."active_start_time" is not null
          and "promotions"."active_end_time" is not null
          and "promotions"."active_start_time" <> "promotions"."active_end_time")),
	CONSTRAINT "promotions_active_days_valid" CHECK ("promotions"."active_days_of_week" is null or (
        cardinality("promotions"."active_days_of_week") between 1 and 7
        and "promotions"."active_days_of_week" <@ array[0, 1, 2, 3, 4, 5, 6]::integer[]
      )),
	CONSTRAINT "promotions_display_priority_nonnegative" CHECK ("promotions"."display_priority" >= 0),
	CONSTRAINT "promotions_media_consistency" CHECK (("promotions"."image_url" is null and "promotions"."mobile_image_url" is null and "promotions"."image_alt" is null)
        or (("promotions"."image_url" is not null or "promotions"."mobile_image_url" is not null)
          and nullif(btrim("promotions"."image_alt"), '') is not null
          and char_length("promotions"."image_alt") <= 200
          and ("promotions"."image_url" is null or (
            "promotions"."image_url" = btrim("promotions"."image_url")
            and "promotions"."image_url" like '/%'
            and "promotions"."image_url" not like '%..%'
            and position(chr(92) in "promotions"."image_url") = 0
          ))
          and ("promotions"."mobile_image_url" is null or (
            "promotions"."mobile_image_url" = btrim("promotions"."mobile_image_url")
            and "promotions"."mobile_image_url" like '/%'
            and "promotions"."mobile_image_url" not like '%..%'
            and position(chr(92) in "promotions"."mobile_image_url") = 0
          )))),
	CONSTRAINT "promotions_homepage_placement_valid" CHECK ("promotions"."show_on_homepage" = false or (
        "promotions"."kind" = 'offer'
        and nullif(btrim("promotions"."image_url"), '') is not null
        and nullif(btrim("promotions"."image_alt"), '') is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "promotion_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promotion_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"promotion_id" integer NOT NULL,
	"rule_type" text NOT NULL,
	"product_id" integer,
	"category_id" integer,
	"quantity" integer,
	"tier_min_paise" integer,
	"tier_discount_type" text,
	"tier_discount_rate_bps" integer,
	"tier_discount_amount_paise" integer,
	"tier_max_discount_paise" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_rules_type_valid" CHECK ("promotion_rules"."rule_type" in ('product_include', 'category_include', 'bxgy_buy', 'bxgy_get', 'tier')),
	CONSTRAINT "promotion_rules_shape_valid" CHECK (("promotion_rules"."rule_type" = 'product_include'
          and "promotion_rules"."product_id" is not null and "promotion_rules"."category_id" is null
          and "promotion_rules"."quantity" is null and "promotion_rules"."tier_min_paise" is null
          and "promotion_rules"."tier_discount_type" is null and "promotion_rules"."tier_discount_rate_bps" is null
          and "promotion_rules"."tier_discount_amount_paise" is null and "promotion_rules"."tier_max_discount_paise" is null)
        or ("promotion_rules"."rule_type" = 'category_include'
          and "promotion_rules"."product_id" is null and "promotion_rules"."category_id" is not null
          and "promotion_rules"."quantity" is null and "promotion_rules"."tier_min_paise" is null
          and "promotion_rules"."tier_discount_type" is null and "promotion_rules"."tier_discount_rate_bps" is null
          and "promotion_rules"."tier_discount_amount_paise" is null and "promotion_rules"."tier_max_discount_paise" is null)
        or ("promotion_rules"."rule_type" in ('bxgy_buy', 'bxgy_get')
          and (("promotion_rules"."product_id" is not null and "promotion_rules"."category_id" is null)
            or ("promotion_rules"."product_id" is null and "promotion_rules"."category_id" is not null))
          and "promotion_rules"."quantity" > 0 and "promotion_rules"."tier_min_paise" is null
          and "promotion_rules"."tier_discount_type" is null and "promotion_rules"."tier_discount_rate_bps" is null
          and "promotion_rules"."tier_discount_amount_paise" is null and "promotion_rules"."tier_max_discount_paise" is null)
        or ("promotion_rules"."rule_type" = 'tier'
          and "promotion_rules"."product_id" is null and "promotion_rules"."category_id" is null
          and "promotion_rules"."quantity" is null and "promotion_rules"."tier_min_paise" >= 0
          and (("promotion_rules"."tier_discount_type" = 'percentage'
              and "promotion_rules"."tier_discount_rate_bps" between 1 and 10000
              and "promotion_rules"."tier_discount_amount_paise" is null
              and ("promotion_rules"."tier_max_discount_paise" is null or "promotion_rules"."tier_max_discount_paise" > 0))
            or ("promotion_rules"."tier_discount_type" = 'fixed_amount'
              and "promotion_rules"."tier_discount_rate_bps" is null
              and "promotion_rules"."tier_discount_amount_paise" > 0
              and "promotion_rules"."tier_max_discount_paise" is null))))
);
--> statement-breakpoint
CREATE TABLE "store_promotion_settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "store_promotion_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"promotion_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"disabled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_promotion_settings_promotion_store_unique" UNIQUE("promotion_id","store_id"),
	CONSTRAINT "store_promotion_settings_reason_valid" CHECK ("store_promotion_settings"."disabled_reason" is null or (
        nullif(btrim("store_promotion_settings"."disabled_reason"), '') is not null
        and char_length("store_promotion_settings"."disabled_reason") <= 500
      ))
);
--> statement-breakpoint
CREATE TABLE "promotion_applications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promotion_applications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"promotion_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"promotion_kind" text NOT NULL,
	"promotion_name" text NOT NULL,
	"promotion_code" text,
	"discount_type" text NOT NULL,
	"definition_version" integer NOT NULL,
	"status" text NOT NULL,
	"item_discount_paise" integer NOT NULL,
	"delivery_discount_paise" integer NOT NULL,
	"total_savings_paise" integer NOT NULL,
	"standard_delivery_fee_paise" integer NOT NULL,
	"charged_delivery_fee_paise" integer NOT NULL,
	"reserved_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_applications_order_promotion_unique" UNIQUE("order_id","promotion_id"),
	CONSTRAINT "promotion_applications_snapshot_identity_valid" CHECK ("promotion_applications"."promotion_kind" in ('offer', 'coupon')
        and nullif(btrim("promotion_applications"."promotion_name"), '') is not null
        and char_length("promotion_applications"."promotion_name") <= 120
        and "promotion_applications"."discount_type" in ('percentage', 'fixed_amount', 'buy_x_get_y', 'free_delivery', 'tiered')
        and "promotion_applications"."definition_version" > 0
        and (("promotion_applications"."promotion_kind" = 'offer' and "promotion_applications"."promotion_code" is null)
          or ("promotion_applications"."promotion_kind" = 'coupon'
            and nullif(btrim("promotion_applications"."promotion_code"), '') is not null
            and "promotion_applications"."promotion_code" = upper(btrim("promotion_applications"."promotion_code"))
            and char_length("promotion_applications"."promotion_code") <= 64
            and "promotion_applications"."discount_type" in ('percentage', 'fixed_amount', 'tiered')))),
	CONSTRAINT "promotion_applications_status_valid" CHECK ("promotion_applications"."status" in ('reserved', 'consumed', 'released')),
	CONSTRAINT "promotion_applications_status_timestamps_valid" CHECK (("promotion_applications"."status" = 'reserved'
          and "promotion_applications"."reserved_at" is not null
          and "promotion_applications"."consumed_at" is null
          and "promotion_applications"."released_at" is null)
        or ("promotion_applications"."status" = 'consumed'
          and "promotion_applications"."consumed_at" is not null
          and "promotion_applications"."released_at" is null)
        or ("promotion_applications"."status" = 'released'
          and "promotion_applications"."reserved_at" is not null
          and "promotion_applications"."consumed_at" is null
          and "promotion_applications"."released_at" is not null)),
	CONSTRAINT "promotion_applications_amounts_valid" CHECK ("promotion_applications"."item_discount_paise" >= 0
        and "promotion_applications"."delivery_discount_paise" >= 0
        and "promotion_applications"."total_savings_paise"::bigint =
          "promotion_applications"."item_discount_paise"::bigint + "promotion_applications"."delivery_discount_paise"::bigint
        and "promotion_applications"."total_savings_paise" > 0
        and "promotion_applications"."standard_delivery_fee_paise" >= 0
        and "promotion_applications"."charged_delivery_fee_paise" >= 0
        and "promotion_applications"."charged_delivery_fee_paise" <= "promotion_applications"."standard_delivery_fee_paise"
        and "promotion_applications"."delivery_discount_paise" <= "promotion_applications"."standard_delivery_fee_paise"
        and ("promotion_applications"."delivery_discount_paise" = 0
          or "promotion_applications"."charged_delivery_fee_paise"::bigint + "promotion_applications"."delivery_discount_paise"::bigint =
            "promotion_applications"."standard_delivery_fee_paise"::bigint))
);
--> statement-breakpoint
CREATE TABLE "promotion_discount_allocations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promotion_discount_allocations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"promotion_application_id" integer NOT NULL,
	"order_item_id" integer,
	"component" text NOT NULL,
	"unit_index" integer,
	"amount_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_discount_allocations_shape_valid" CHECK (("promotion_discount_allocations"."component" = 'item'
          and "promotion_discount_allocations"."order_item_id" is not null
          and "promotion_discount_allocations"."unit_index" >= 0)
        or ("promotion_discount_allocations"."component" = 'delivery'
          and "promotion_discount_allocations"."order_item_id" is null
          and "promotion_discount_allocations"."unit_index" is null)),
	CONSTRAINT "promotion_discount_allocations_amount_positive" CHECK ("promotion_discount_allocations"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "bundle_components" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bundle_components_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bundle_product_id" integer NOT NULL,
	"component_product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_components_bundle_product_unique" UNIQUE("bundle_product_id","component_product_id"),
	CONSTRAINT "bundle_components_quantity_positive" CHECK ("bundle_components"."quantity" > 0),
	CONSTRAINT "bundle_components_distinct_products" CHECK ("bundle_components"."bundle_product_id" <> "bundle_components"."component_product_id")
);
--> statement-breakpoint
CREATE TABLE "order_item_bundle_components" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_item_bundle_components_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_item_id" integer NOT NULL,
	"component_product_id" integer NOT NULL,
	"component_name" text NOT NULL,
	"quantity_per_bundle" integer NOT NULL,
	"total_quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_item_bundle_components_item_product_unique" UNIQUE("order_item_id","component_product_id"),
	CONSTRAINT "order_item_bundle_components_name_present" CHECK (nullif(btrim("order_item_bundle_components"."component_name"), '') is not null),
	CONSTRAINT "order_item_bundle_components_quantities_positive" CHECK ("order_item_bundle_components"."quantity_per_bundle" > 0 and "order_item_bundle_components"."total_quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_price_amounts_nonnegative";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_type" text DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "compare_at_price_paise" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_type" text DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "compare_at_unit_price_paise" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "bundle_markdown_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_mode" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "promotion_rules" ADD CONSTRAINT "promotion_rules_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_rules" ADD CONSTRAINT "promotion_rules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_rules" ADD CONSTRAINT "promotion_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_promotion_settings" ADD CONSTRAINT "store_promotion_settings_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_promotion_settings" ADD CONSTRAINT "store_promotion_settings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_promotion_settings" ADD CONSTRAINT "store_promotion_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_discount_allocations" ADD CONSTRAINT "promotion_discount_allocations_promotion_application_id_promotion_applications_id_fk" FOREIGN KEY ("promotion_application_id") REFERENCES "public"."promotion_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_discount_allocations" ADD CONSTRAINT "promotion_discount_allocations_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_bundle_product_id_products_id_fk" FOREIGN KEY ("bundle_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_component_product_id_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_bundle_components" ADD CONSTRAINT "order_item_bundle_components_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_bundle_components" ADD CONSTRAINT "order_item_bundle_components_component_product_id_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "promotions_normalized_code_unique" ON "promotions" USING btree (upper(btrim("code"))) WHERE "promotions"."code" is not null;--> statement-breakpoint
CREATE INDEX "promotions_active_discovery_idx" ON "promotions" USING btree ("kind","is_active","starts_at","ends_at","display_priority","id");--> statement-breakpoint
CREATE INDEX "promotions_capacity_budget_idx" ON "promotions" USING btree ("is_active","max_redemptions","total_discount_budget_paise","id");--> statement-breakpoint
CREATE INDEX "promotion_rules_promotion_type_idx" ON "promotion_rules" USING btree ("promotion_id","rule_type","id");--> statement-breakpoint
CREATE INDEX "promotion_rules_product_target_idx" ON "promotion_rules" USING btree ("product_id","promotion_id");--> statement-breakpoint
CREATE INDEX "promotion_rules_category_target_idx" ON "promotion_rules" USING btree ("category_id","promotion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_rules_product_target_unique" ON "promotion_rules" USING btree ("promotion_id","rule_type","product_id") WHERE "promotion_rules"."product_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_rules_category_target_unique" ON "promotion_rules" USING btree ("promotion_id","rule_type","category_id") WHERE "promotion_rules"."category_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_rules_tier_threshold_unique" ON "promotion_rules" USING btree ("promotion_id","tier_min_paise") WHERE "promotion_rules"."rule_type" = 'tier';--> statement-breakpoint
CREATE INDEX "store_promotion_settings_store_enabled_idx" ON "store_promotion_settings" USING btree ("store_id","is_enabled","promotion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_applications_active_coupon_order_unique" ON "promotion_applications" USING btree ("order_id") WHERE "promotion_applications"."promotion_kind" = 'coupon' and "promotion_applications"."status" in ('reserved', 'consumed');--> statement-breakpoint
CREATE INDEX "promotion_applications_capacity_idx" ON "promotion_applications" USING btree ("promotion_id","status","id");--> statement-breakpoint
CREATE INDEX "promotion_applications_user_usage_idx" ON "promotion_applications" USING btree ("promotion_id","user_id","status","id");--> statement-breakpoint
CREATE INDEX "promotion_applications_budget_usage_idx" ON "promotion_applications" USING btree ("promotion_id","status","total_savings_paise");--> statement-breakpoint
CREATE INDEX "promotion_applications_store_analytics_idx" ON "promotion_applications" USING btree ("promotion_id","store_id","status","created_at");--> statement-breakpoint
CREATE INDEX "promotion_applications_order_status_idx" ON "promotion_applications" USING btree ("order_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_discount_allocations_item_unit_unique" ON "promotion_discount_allocations" USING btree ("promotion_application_id","order_item_id","unit_index") WHERE "promotion_discount_allocations"."component" = 'item';--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_discount_allocations_delivery_unique" ON "promotion_discount_allocations" USING btree ("promotion_application_id") WHERE "promotion_discount_allocations"."component" = 'delivery';--> statement-breakpoint
CREATE INDEX "promotion_discount_allocations_order_item_idx" ON "promotion_discount_allocations" USING btree ("order_item_id","promotion_application_id");--> statement-breakpoint
CREATE INDEX "bundle_components_component_product_idx" ON "bundle_components" USING btree ("component_product_id","bundle_product_id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_product_type_valid" CHECK ("products"."product_type" in ('single', 'bundle'));--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_compare_at_price_valid" CHECK ("store_products"."compare_at_price_paise" is null or "store_products"."compare_at_price_paise" > "store_products"."price_paise");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_type_valid" CHECK ("order_items"."product_type" in ('single', 'bundle'));--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_bundle_snapshot_valid" CHECK (("order_items"."product_type" = 'single'
          and "order_items"."compare_at_unit_price_paise" is null
          and "order_items"."bundle_markdown_paise" = 0)
        or ("order_items"."product_type" = 'bundle'
          and "order_items"."compare_at_unit_price_paise" is not null
          and "order_items"."compare_at_unit_price_paise" > "order_items"."unit_price_paise"
          and "order_items"."bundle_markdown_paise"::bigint =
            ("order_items"."compare_at_unit_price_paise"::bigint - "order_items"."unit_price_paise"::bigint)
              * "order_items"."quantity"::bigint));--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_price_amounts_nonnegative" CHECK ("order_items"."unit_price_paise" >= 0
        and "order_items"."bundle_markdown_paise" >= 0
        and "order_items"."line_subtotal_paise" >= 0
        and "order_items"."discount_allocation_paise" >= 0
        and "order_items"."taxable_amount_paise" >= 0
        and "order_items"."tax_paise" >= 0
        and "order_items"."line_total_paise" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_mode_valid" CHECK ("orders"."discount_mode" in ('none', 'automatic_deals', 'coupon'));