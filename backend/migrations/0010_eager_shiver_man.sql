CREATE TABLE "delivery_pricing_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "delivery_pricing_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"version" integer NOT NULL,
	"delivery_fee_paise" integer NOT NULL,
	"free_delivery_threshold_paise" integer,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_pricing_rules_store_version_unique" UNIQUE("store_id","version"),
	CONSTRAINT "delivery_pricing_rules_store_effective_from_unique" UNIQUE("store_id","effective_from"),
	CONSTRAINT "delivery_pricing_rules_version_positive" CHECK ("delivery_pricing_rules"."version" > 0),
	CONSTRAINT "delivery_pricing_rules_amounts_valid" CHECK ("delivery_pricing_rules"."delivery_fee_paise" >= 0
        and ("delivery_pricing_rules"."free_delivery_threshold_paise" is null or "delivery_pricing_rules"."free_delivery_threshold_paise" > 0)),
	CONSTRAINT "delivery_pricing_rules_effective_range_valid" CHECK ("delivery_pricing_rules"."effective_to" is null or "delivery_pricing_rules"."effective_to" >= "delivery_pricing_rules"."effective_from")
);
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint
ALTER TABLE "delivery_pricing_rules"
  ADD CONSTRAINT "delivery_pricing_rules_no_effective_overlap"
  EXCLUDE USING gist (
    "store_id" WITH =,
    daterange("effective_from", COALESCE("effective_to", 'infinity'::date), '[]') WITH &&
  );--> statement-breakpoint
ALTER TABLE "delivery_price" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "delivery_price" CASCADE;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "timezone" text DEFAULT 'Asia/Kolkata' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_pricing_rule_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_pricing_rule_version" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pricing_business_date" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pricing_timezone" text NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_pricing_rules" ADD CONSTRAINT "delivery_pricing_rules_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_pricing_rule_id_delivery_pricing_rules_id_fk" FOREIGN KEY ("delivery_pricing_rule_id") REFERENCES "public"."delivery_pricing_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_pricing_rule_version_positive" CHECK ("orders"."delivery_pricing_rule_version" > 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pricing_business_date_valid" CHECK ("orders"."pricing_business_date" ~ '^\d{4}-\d{2}-\d{2}$');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pricing_timezone_present" CHECK (nullif(btrim("orders"."pricing_timezone"), '') is not null);
