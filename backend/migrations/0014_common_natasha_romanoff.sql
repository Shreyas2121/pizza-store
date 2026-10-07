CREATE TABLE "refund_allocations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refund_allocations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"refund_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"kind" text NOT NULL,
	"order_item_id" integer,
	"quantity" integer,
	"amount_paise" integer NOT NULL,
	"taxable_amount_paise" integer NOT NULL,
	"tax_paise" integer NOT NULL,
	"discount_reversal_paise" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_allocations_kind_valid" CHECK ("refund_allocations"."kind" in ('item', 'delivery_fee')),
	CONSTRAINT "refund_allocations_target_valid" CHECK (("refund_allocations"."kind" = 'item' and "refund_allocations"."order_item_id" is not null and "refund_allocations"."quantity" > 0)
        or ("refund_allocations"."kind" = 'delivery_fee' and "refund_allocations"."order_item_id" is null and "refund_allocations"."quantity" is null)),
	CONSTRAINT "refund_allocations_amounts_valid" CHECK ("refund_allocations"."amount_paise" > 0
        and "refund_allocations"."taxable_amount_paise" >= 0
        and "refund_allocations"."tax_paise" >= 0
        and "refund_allocations"."discount_reversal_paise" >= 0
        and "refund_allocations"."taxable_amount_paise"::bigint + "refund_allocations"."tax_paise"::bigint = "refund_allocations"."amount_paise"::bigint)
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refunds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"payment_attempt_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"reason_code" text NOT NULL,
	"reason_note" text,
	"client_request_id" text NOT NULL,
	"provider_refund_id" text,
	"provider_status" text,
	"failure_code" text,
	"failure_description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"requested_by" integer NOT NULL,
	"approved_by" integer,
	"rejected_by" integer,
	"cancelled_by" integer,
	"submitted_by" integer,
	"processed_by" integer,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_client_request_id_unique" UNIQUE("client_request_id"),
	CONSTRAINT "refunds_provider_refund_id_unique" UNIQUE("provider_refund_id"),
	CONSTRAINT "refunds_allocation_scope_unique" UNIQUE("id","order_id"),
	CONSTRAINT "refunds_amount_paise_positive" CHECK ("refunds"."amount_paise" > 0),
	CONSTRAINT "refunds_currency_inr" CHECK ("refunds"."currency" = 'INR'),
	CONSTRAINT "refunds_status_valid" CHECK ("refunds"."status" in ('requested', 'approved', 'rejected', 'cancelled', 'submitted', 'processing', 'processed', 'failed')),
	CONSTRAINT "refunds_reason_code_present" CHECK (nullif(btrim("refunds"."reason_code"), '') is not null and char_length("refunds"."reason_code") <= 100),
	CONSTRAINT "refunds_reason_note_valid" CHECK ("refunds"."reason_note" is null or (nullif(btrim("refunds"."reason_note"), '') is not null and char_length("refunds"."reason_note") <= 1000)),
	CONSTRAINT "refunds_client_request_id_present" CHECK (nullif(btrim("refunds"."client_request_id"), '') is not null and char_length("refunds"."client_request_id") <= 255),
	CONSTRAINT "refunds_provider_refund_id_valid" CHECK ("refunds"."provider_refund_id" is null or nullif(btrim("refunds"."provider_refund_id"), '') is not null),
	CONSTRAINT "refunds_version_positive" CHECK ("refunds"."version" > 0),
	CONSTRAINT "refunds_actor_timestamp_pairs" CHECK (("refunds"."approved_by" is null) = ("refunds"."approved_at" is null)
        and ("refunds"."rejected_by" is null) = ("refunds"."rejected_at" is null)
        and ("refunds"."cancelled_by" is null) = ("refunds"."cancelled_at" is null)
        and ("refunds"."submitted_by" is null) = ("refunds"."submitted_at" is null)
        and ("refunds"."processed_by" is null or "refunds"."processed_at" is not null)),
	CONSTRAINT "refunds_status_evidence" CHECK (("refunds"."status" not in ('approved', 'submitted', 'processing', 'processed', 'failed') or "refunds"."approved_at" is not null)
        and ("refunds"."status" not in ('submitted', 'processing', 'processed', 'failed') or "refunds"."submitted_at" is not null)
        and ("refunds"."status" <> 'rejected' or "refunds"."rejected_at" is not null)
        and ("refunds"."status" <> 'cancelled' or "refunds"."cancelled_at" is not null)
        and ("refunds"."status" <> 'processed' or "refunds"."processed_at" is not null)
        and ("refunds"."status" <> 'failed' or "refunds"."failed_at" is not null)),
	CONSTRAINT "refunds_timestamps_ordered" CHECK (("refunds"."approved_at" is null or "refunds"."approved_at" >= "refunds"."requested_at")
        and ("refunds"."rejected_at" is null or "refunds"."rejected_at" >= "refunds"."requested_at")
        and ("refunds"."cancelled_at" is null or "refunds"."cancelled_at" >= "refunds"."requested_at")
        and ("refunds"."submitted_at" is null or "refunds"."submitted_at" >= "refunds"."requested_at")
        and ("refunds"."processed_at" is null or "refunds"."processed_at" >= "refunds"."requested_at")
        and ("refunds"."failed_at" is null or "refunds"."failed_at" >= "refunds"."requested_at"))
);
--> statement-breakpoint
ALTER TABLE "refund_allocations" ADD CONSTRAINT "refund_allocations_refund_order_fk" FOREIGN KEY ("refund_id","order_id") REFERENCES "public"."refunds"("id","order_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_refund_scope_unique" UNIQUE("id","order_id");
--> statement-breakpoint
ALTER TABLE "refund_allocations" ADD CONSTRAINT "refund_allocations_item_order_fk" FOREIGN KEY ("order_item_id","order_id") REFERENCES "public"."order_items"("id","order_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_refund_scope_unique" UNIQUE("id","order_id","store_id");
--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_attempt_order_store_fk" FOREIGN KEY ("payment_attempt_id","order_id","store_id") REFERENCES "public"."payment_attempts"("id","order_id","store_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "refund_allocations_refund_id_idx" ON "refund_allocations" USING btree ("refund_id");
--> statement-breakpoint
CREATE INDEX "refund_allocations_order_item_id_idx" ON "refund_allocations" USING btree ("order_item_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "refund_allocations_item_unique" ON "refund_allocations" USING btree ("refund_id","order_item_id") WHERE "refund_allocations"."kind" = 'item';
--> statement-breakpoint
CREATE UNIQUE INDEX "refund_allocations_delivery_fee_unique" ON "refund_allocations" USING btree ("refund_id","kind") WHERE "refund_allocations"."kind" = 'delivery_fee';
--> statement-breakpoint
CREATE INDEX "refunds_store_requested_at_idx" ON "refunds" USING btree ("store_id","requested_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "refunds_order_id_idx" ON "refunds" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX "refunds_payment_attempt_id_idx" ON "refunds" USING btree ("payment_attempt_id");
--> statement-breakpoint
CREATE INDEX "refunds_store_status_idx" ON "refunds" USING btree ("store_id","status");
