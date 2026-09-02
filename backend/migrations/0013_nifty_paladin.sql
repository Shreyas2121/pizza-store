CREATE TABLE "payment_attempts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"provider" text DEFAULT 'cod' NOT NULL,
	"method" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_status" text,
	"amount_paise" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"provider_order_id" text,
	"provider_payment_id" text,
	"client_request_id" text,
	"failure_code" text,
	"failure_description" text,
	"authorized_at" timestamp with time zone,
	"captured_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_provider_order_id_unique" UNIQUE("provider_order_id"),
	CONSTRAINT "payment_attempts_provider_payment_id_unique" UNIQUE("provider_payment_id"),
	CONSTRAINT "payment_attempts_client_request_id_unique" UNIQUE("client_request_id"),
	CONSTRAINT "payment_attempts_amount_paise_nonnegative" CHECK ("payment_attempts"."amount_paise" >= 0),
	CONSTRAINT "payment_attempts_provider_valid" CHECK ("payment_attempts"."provider" in ('cod', 'razorpay')),
	CONSTRAINT "payment_attempts_status_valid" CHECK ("payment_attempts"."status" in ('pending', 'processing', 'authorized', 'captured', 'failed', 'expired', 'cancelled', 'voided')),
	CONSTRAINT "payment_attempts_currency_inr" CHECK ("payment_attempts"."currency" = 'INR'),
	CONSTRAINT "payment_attempts_method_valid" CHECK ("payment_attempts"."method" is null or "payment_attempts"."method" in ('cash', 'card', 'upi', 'netbanking', 'wallet', 'other'))
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_attempts_order_id_idx" ON "payment_attempts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_store_id_idx" ON "payment_attempts" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_status_idx" ON "payment_attempts" USING btree ("status");