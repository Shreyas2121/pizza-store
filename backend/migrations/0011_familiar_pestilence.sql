CREATE TABLE "tax_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"component" text NOT NULL,
	"version" integer NOT NULL,
	"rate_bps" integer NOT NULL,
	"hsn_sac_code" text NOT NULL,
	"is_demo" boolean DEFAULT true NOT NULL,
	"disclaimer" text DEFAULT 'Portfolio demo — not a statutory tax invoice' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_rules_store_component_version_unique" UNIQUE("store_id","component","version"),
	CONSTRAINT "tax_rules_store_component_effective_from_unique" UNIQUE("store_id","component","effective_from"),
	CONSTRAINT "tax_rules_component_valid" CHECK ("tax_rules"."component" in ('item', 'delivery')),
	CONSTRAINT "tax_rules_version_positive" CHECK ("tax_rules"."version" > 0),
	CONSTRAINT "tax_rules_rate_valid" CHECK ("tax_rules"."rate_bps" between 0 and 10000),
	CONSTRAINT "tax_rules_hsn_sac_code_present" CHECK (nullif(btrim("tax_rules"."hsn_sac_code"), '') is not null),
	CONSTRAINT "tax_rules_demo_only" CHECK ("tax_rules"."is_demo" = true),
	CONSTRAINT "tax_rules_disclaimer_exact" CHECK ("tax_rules"."disclaimer" = 'Portfolio demo — not a statutory tax invoice'),
	CONSTRAINT "tax_rules_effective_range_valid" CHECK ("tax_rules"."effective_to" is null or "tax_rules"."effective_to" >= "tax_rules"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "tax_rules"
  ADD CONSTRAINT "tax_rules_no_effective_overlap"
  EXCLUDE USING gist (
    "store_id" WITH =,
    "component" WITH =,
    daterange("effective_from", COALESCE("effective_to", 'infinity'::date), '[]') WITH &&
  );--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_tax_rate_valid";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_rule_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_rule_version" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "hsn_sac_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_calculation_policy_version" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_disclaimer" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_is_demo" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "place_of_supply_state" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_tax_rule_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_tax_rule_version" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_tax_rate_bps" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_taxable_amount_paise" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_tax_paise" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_hsn_sac_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tax_rule_id_tax_rules_id_fk" FOREIGN KEY ("tax_rule_id") REFERENCES "public"."tax_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_tax_rule_id_tax_rules_id_fk" FOREIGN KEY ("delivery_tax_rule_id") REFERENCES "public"."tax_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tax_rate_valid" CHECK ("order_items"."tax_rate_bps" between 0 and 10000 and "order_items"."tax_rule_version" > 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tax_metadata_valid" CHECK ("orders"."tax_calculation_policy_version" > 0
        and "orders"."tax_is_demo" = true
        and "orders"."tax_disclaimer" = 'Portfolio demo — not a statutory tax invoice'
        and nullif(btrim("orders"."place_of_supply_state"), '') is not null);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_tax_snapshot_valid" CHECK ("orders"."delivery_tax_rule_version" > 0
        and "orders"."delivery_tax_rate_bps" between 0 and 10000
        and "orders"."delivery_taxable_amount_paise" >= 0
        and "orders"."delivery_tax_paise" >= 0
        and "orders"."delivery_taxable_amount_paise"::bigint + "orders"."delivery_tax_paise"::bigint = "orders"."delivery_fee_paise"::bigint
        and nullif(btrim("orders"."delivery_hsn_sac_code"), '') is not null);
