CREATE TABLE "coupon_redemptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coupon_redemptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"coupon_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_redemptions_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "coupon_redemptions_status_valid" CHECK ("coupon_redemptions"."status" in ('reserved', 'consumed', 'released'))
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_webhook_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_webhook_events_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "payment_webhook_events_status_valid" CHECK ("payment_webhook_events"."status" in ('processing', 'processed', 'failed')),
	CONSTRAINT "payment_webhook_events_attempts_positive" CHECK ("payment_webhook_events"."attempts" >= 1)
);
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "payment_date" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "payment_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider" text DEFAULT 'cod' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_status" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "amount_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "currency" text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_order_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_payment_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "client_request_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "failure_code" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "failure_description" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Existing linked payments are COD records. Store their authoritative order
-- amount in paise without changing the conservative pending payment status.
UPDATE "payments" AS "payment"
SET
	"provider" = 'cod',
	"amount_paise" = ROUND(GREATEST("order_row"."total_price", 0) * 100)::integer,
	"currency" = 'INR',
	"updated_at" = now()
FROM "orders" AS "order_row"
WHERE "order_row"."payment_id" = "payment"."id"
	AND "order_row"."payment_type" = 'cash';
--> statement-breakpoint

-- The current checkout does not call /payments/process-cod, so most legacy
-- COD orders have no payment row. Backfill one pending row per order. The
-- duplicate clause also repairs any legacy payment linked to multiple orders
-- before the one-to-one uniqueness constraint is added.
DO $$
DECLARE
	"legacy_order" RECORD;
	"new_payment_id" integer;
BEGIN
	FOR "legacy_order" IN
		SELECT "order_row".*
		FROM "orders" AS "order_row"
		WHERE "order_row"."payment_type" = 'cash'
			AND (
				"order_row"."payment_id" IS NULL
				OR EXISTS (
					SELECT 1
					FROM "orders" AS "earlier_order"
					WHERE "earlier_order"."payment_id" = "order_row"."payment_id"
						AND "earlier_order"."id" < "order_row"."id"
				)
			)
		ORDER BY "order_row"."id"
	LOOP
		INSERT INTO "payments" (
			"provider",
			"status",
			"amount_paise",
			"currency",
			"created_at",
			"updated_at"
		)
		VALUES (
			'cod',
			'pending',
			ROUND(GREATEST("legacy_order"."total_price", 0) * 100)::integer,
			'INR',
			COALESCE("legacy_order"."order_date", now()),
			now()
		)
		RETURNING "id" INTO "new_payment_id";

		UPDATE "orders"
		SET "payment_id" = "new_payment_id", "updated_at" = now()
		WHERE "id" = "legacy_order"."id";
	END LOOP;
END $$;
--> statement-breakpoint

-- Preserve historical coupon usage at the order level. A consumed record is
-- safer than making a previously placed discounted order reservable again.
INSERT INTO "coupon_redemptions" (
	"coupon_id",
	"order_id",
	"user_id",
	"status",
	"reserved_at",
	"consumed_at",
	"created_at",
	"updated_at"
)
SELECT
	"order_row"."coupon_id",
	"order_row"."id",
	"order_row"."user_id",
	'consumed',
	COALESCE("order_row"."order_date", now()),
	COALESCE("order_row"."order_date", now()),
	COALESCE("order_row"."order_date", now()),
	now()
FROM "orders" AS "order_row"
WHERE "order_row"."coupon_id" IS NOT NULL
ON CONFLICT ("order_id") DO NOTHING;
--> statement-breakpoint

CREATE INDEX "coupon_redemptions_coupon_status_idx" ON "coupon_redemptions" USING btree ("coupon_id","status");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_user_idx" ON "coupon_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_status_idx" ON "payment_webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_id_unique" UNIQUE("payment_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_order_id_unique" UNIQUE("provider_order_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_payment_id_unique" UNIQUE("provider_payment_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_request_id_unique" UNIQUE("client_request_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_paise_nonnegative" CHECK ("payments"."amount_paise" >= 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_valid" CHECK ("payments"."provider" in ('cod', 'razorpay'));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_inr" CHECK ("payments"."currency" = 'INR');
