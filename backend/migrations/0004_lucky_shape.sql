CREATE TABLE "inventory_movements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_product_id" integer NOT NULL,
	"change_type" text NOT NULL,
	"quantity_change" integer NOT NULL,
	"previous_quantity" integer NOT NULL,
	"new_quantity" integer NOT NULL,
	"reason" text,
	"order_id" integer,
	"idempotency_key" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_movements_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "inventory_movements_change_type_valid" CHECK ("inventory_movements"."change_type" in ('sale', 'restock', 'adjustment', 'return', 'cancellation')),
	CONSTRAINT "inventory_movements_quantity_equation_valid" CHECK ("inventory_movements"."new_quantity" = "inventory_movements"."previous_quantity" + "inventory_movements"."quantity_change"),
	CONSTRAINT "inventory_movements_quantities_nonnegative" CHECK ("inventory_movements"."previous_quantity" >= 0 and "inventory_movements"."new_quantity" >= 0),
	CONSTRAINT "inventory_movements_adjustment_reason_required" CHECK ("inventory_movements"."change_type" <> 'adjustment' or nullif(btrim("inventory_movements"."reason"), '') is not null)
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_reservations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"store_product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_reservations_order_store_product_unique" UNIQUE("order_id","store_product_id"),
	CONSTRAINT "inventory_reservations_quantity_positive" CHECK ("inventory_reservations"."quantity" > 0),
	CONSTRAINT "inventory_reservations_status_valid" CHECK ("inventory_reservations"."status" in ('reserved', 'consumed', 'released'))
);
--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "on_hand_quantity" integer;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "low_stock_threshold" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "last_restocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_store_product_id_store_products_id_fk" FOREIGN KEY ("store_product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_store_product_id_store_products_id_fk" FOREIGN KEY ("store_product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_movements_store_product_created_at_idx" ON "inventory_movements" USING btree ("store_product_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inventory_movements_order_change_type_idx" ON "inventory_movements" USING btree ("order_id","change_type");--> statement-breakpoint
CREATE INDEX "inventory_reservations_store_product_status_idx" ON "inventory_reservations" USING btree ("store_product_id","status");--> statement-breakpoint
CREATE INDEX "inventory_reservations_status_expires_at_idx" ON "inventory_reservations" USING btree ("status","expires_at");--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_on_hand_quantity_nonnegative" CHECK ("store_products"."on_hand_quantity" is null or "store_products"."on_hand_quantity" >= 0);--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_low_stock_threshold_nonnegative" CHECK ("store_products"."low_stock_threshold" >= 0);