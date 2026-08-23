CREATE TABLE "store_products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "store_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"price" real NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_products_store_id_product_id_unique" UNIQUE("store_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"latitude" double precision,
	"longitude" double precision,
	"opens_at" text NOT NULL,
	"closes_at" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN "store_id" integer;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "store_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "store_id" integer;--> statement-breakpoint
INSERT INTO "stores" (
	"name",
	"slug",
	"address",
	"city",
	"state",
	"pincode",
	"phone",
	"opens_at",
	"closes_at"
)
VALUES (
	'PizzaStore - Default',
	'default',
	'Legacy store address',
	'Mumbai',
	'Maharashtra',
	COALESCE((SELECT "pincode" FROM "delivery_zones" ORDER BY "id" LIMIT 1), '400001'),
	'0000000000',
	'00:00',
	'23:59'
);--> statement-breakpoint
INSERT INTO "store_products" ("store_id", "product_id", "price")
SELECT "stores"."id", "products"."id", "products"."price"
FROM "stores"
CROSS JOIN "products"
WHERE "stores"."slug" = 'default';--> statement-breakpoint
UPDATE "delivery_zones"
SET "store_id" = (SELECT "id" FROM "stores" WHERE "slug" = 'default');--> statement-breakpoint
UPDATE "orders"
SET "store_id" = (SELECT "id" FROM "stores" WHERE "slug" = 'default');--> statement-breakpoint
UPDATE "cart"
SET "store_id" = (SELECT "id" FROM "stores" WHERE "slug" = 'default');--> statement-breakpoint
ALTER TABLE "delivery_zones" ALTER COLUMN "store_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "store_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_zones" DROP CONSTRAINT "delivery_zones_pincode_unique";--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_store_id_pincode_unique" UNIQUE("store_id","pincode");
