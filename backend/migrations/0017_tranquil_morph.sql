CREATE TABLE "product_cost_versions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_cost_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_product_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"unit_cost_paise" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"source" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_cost_versions_id_store_unique" UNIQUE("id","store_id"),
	CONSTRAINT "product_cost_versions_store_product_from_unique" UNIQUE("store_product_id","effective_from"),
	CONSTRAINT "product_cost_versions_amount_nonnegative" CHECK ("product_cost_versions"."unit_cost_paise" >= 0),
	CONSTRAINT "product_cost_versions_source_present" CHECK (nullif(btrim("product_cost_versions"."source"), '') is not null and char_length("product_cost_versions"."source") <= 255),
	CONSTRAINT "product_cost_versions_range_valid" CHECK ("product_cost_versions"."effective_to" is null or "product_cost_versions"."effective_to" >= "product_cost_versions"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_cost_snapshot_complete";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "cost_version_id" integer;--> statement-breakpoint
ALTER TABLE "product_cost_versions" ADD CONSTRAINT "product_cost_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_cost_versions" ADD CONSTRAINT "product_cost_versions_store_product_store_fk" FOREIGN KEY ("store_product_id","store_id") REFERENCES "public"."store_products"("id","store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_cost_versions_store_product_effective_idx" ON "product_cost_versions" USING btree ("store_product_id","effective_from","effective_to");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint
ALTER TABLE "product_cost_versions" ADD CONSTRAINT "product_cost_versions_no_overlap" EXCLUDE USING gist (
	"store_product_id" WITH =,
	daterange("effective_from", COALESCE("effective_to", 'infinity'::date), '[]') WITH &&
);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_cost_version_id_product_cost_versions_id_fk" FOREIGN KEY ("cost_version_id") REFERENCES "public"."product_cost_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_id_store_id_unique" UNIQUE("id","store_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_cost_snapshot_complete" CHECK (("order_items"."unit_cost_paise" is null and "order_items"."line_cost_paise" is null and "order_items"."cost_version_id" is null)
        or ("order_items"."unit_cost_paise" is not null and "order_items"."line_cost_paise" is not null and "order_items"."cost_version_id" is not null));
