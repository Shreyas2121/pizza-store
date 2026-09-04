CREATE TABLE "reconciliation_issues" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reconciliation_issues_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"batch_id" integer,
	"settlement_line_id" integer,
	"payment_attempt_id" integer,
	"refund_id" integer,
	"issue_type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"owner_user_id" integer,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolution_note" text,
	"resolved_by" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reconciliation_issues_type_valid" CHECK ("reconciliation_issues"."issue_type" in ('missing_local', 'missing_provider', 'amount_mismatch', 'currency_mismatch', 'duplicate', 'unexpected_status', 'stale_pending')),
	CONSTRAINT "reconciliation_issues_severity_valid" CHECK ("reconciliation_issues"."severity" in ('info', 'warning', 'error', 'critical')),
	CONSTRAINT "reconciliation_issues_status_valid" CHECK ("reconciliation_issues"."status" in ('open', 'resolved')),
	CONSTRAINT "reconciliation_issues_resolution_valid" CHECK (("reconciliation_issues"."status" = 'resolved' and "reconciliation_issues"."resolved_by" is not null and "reconciliation_issues"."resolved_at" is not null
          and nullif(btrim("reconciliation_issues"."resolution_note"), '') is not null)
        or ("reconciliation_issues"."status" = 'open' and "reconciliation_issues"."resolved_by" is null and "reconciliation_issues"."resolved_at" is null
          and "reconciliation_issues"."resolution_note" is null))
);
--> statement-breakpoint
CREATE TABLE "settlement_batches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "settlement_batches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"provider" text DEFAULT 'razorpay' NOT NULL,
	"provider_settlement_id" text NOT NULL,
	"provider_status" text NOT NULL,
	"status" text DEFAULT 'imported' NOT NULL,
	"source" text NOT NULL,
	"period_from" timestamp with time zone NOT NULL,
	"period_to" timestamp with time zone NOT NULL,
	"gross_amount_paise" integer NOT NULL,
	"fee_paise" integer NOT NULL,
	"fee_tax_paise" integer NOT NULL,
	"adjustment_paise" integer DEFAULT 0 NOT NULL,
	"net_amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"utr" text,
	"provider_reference" text,
	"payload_hash" text NOT NULL,
	"settled_at" timestamp with time zone NOT NULL,
	"imported_by" integer NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_batches_provider_settlement_id_unique" UNIQUE("provider_settlement_id"),
	CONSTRAINT "settlement_batches_id_store_unique" UNIQUE("id","store_id"),
	CONSTRAINT "settlement_batches_provider_valid" CHECK ("settlement_batches"."provider" = 'razorpay'),
	CONSTRAINT "settlement_batches_provider_identity_present" CHECK (nullif(btrim("settlement_batches"."provider_settlement_id"), '') is not null
        and nullif(btrim("settlement_batches"."provider_status"), '') is not null),
	CONSTRAINT "settlement_batches_source_valid" CHECK ("settlement_batches"."source" in ('fixture', 'test_provider')),
	CONSTRAINT "settlement_batches_status_valid" CHECK ("settlement_batches"."status" in ('imported', 'reconciling', 'needs_review', 'reconciled')),
	CONSTRAINT "settlement_batches_currency_inr" CHECK ("settlement_batches"."currency" = 'INR'),
	CONSTRAINT "settlement_batches_period_valid" CHECK ("settlement_batches"."period_to" >= "settlement_batches"."period_from"),
	CONSTRAINT "settlement_batches_settled_at_valid" CHECK ("settlement_batches"."settled_at" >= "settlement_batches"."period_from"),
	CONSTRAINT "settlement_batches_amounts_valid" CHECK ("settlement_batches"."gross_amount_paise" >= 0
        and "settlement_batches"."fee_paise" >= 0
        and "settlement_batches"."fee_tax_paise" >= 0
        and "settlement_batches"."net_amount_paise" >= 0
        and "settlement_batches"."net_amount_paise"::bigint = "settlement_batches"."gross_amount_paise"::bigint
          - "settlement_batches"."fee_paise"::bigint - "settlement_batches"."fee_tax_paise"::bigint
          + "settlement_batches"."adjustment_paise"::bigint),
	CONSTRAINT "settlement_batches_payload_hash_valid" CHECK ("settlement_batches"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "settlement_batches_reconciled_evidence" CHECK (("settlement_batches"."status" = 'reconciled') = ("settlement_batches"."reconciled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "settlement_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "settlement_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"batch_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"provider_line_id" text NOT NULL,
	"provider_transaction_id" text NOT NULL,
	"provider_entity_id" text NOT NULL,
	"type" text NOT NULL,
	"provider_status" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"fee_paise" integer DEFAULT 0 NOT NULL,
	"fee_tax_paise" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"match_status" text DEFAULT 'unmatched' NOT NULL,
	"payment_attempt_id" integer,
	"refund_id" integer,
	"payload_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_lines_provider_line_id_unique" UNIQUE("provider_line_id"),
	CONSTRAINT "settlement_lines_id_store_unique" UNIQUE("id","store_id"),
	CONSTRAINT "settlement_lines_type_valid" CHECK ("settlement_lines"."type" in ('payment', 'refund', 'adjustment')),
	CONSTRAINT "settlement_lines_provider_identity_present" CHECK (nullif(btrim("settlement_lines"."provider_line_id"), '') is not null
        and nullif(btrim("settlement_lines"."provider_transaction_id"), '') is not null
        and nullif(btrim("settlement_lines"."provider_entity_id"), '') is not null
        and nullif(btrim("settlement_lines"."provider_status"), '') is not null),
	CONSTRAINT "settlement_lines_match_status_valid" CHECK ("settlement_lines"."match_status" in ('unmatched', 'matched', 'mismatch', 'ignored')),
	CONSTRAINT "settlement_lines_currency_inr" CHECK ("settlement_lines"."currency" = 'INR'),
	CONSTRAINT "settlement_lines_amount_nonzero" CHECK ("settlement_lines"."amount_paise" <> 0),
	CONSTRAINT "settlement_lines_fees_nonnegative" CHECK ("settlement_lines"."fee_paise" >= 0 and "settlement_lines"."fee_tax_paise" >= 0),
	CONSTRAINT "settlement_lines_payload_hash_valid" CHECK ("settlement_lines"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "settlement_lines_local_target_valid" CHECK (("settlement_lines"."type" = 'payment' and "settlement_lines"."refund_id" is null)
        or ("settlement_lines"."type" = 'refund' and "settlement_lines"."payment_attempt_id" is null)
        or ("settlement_lines"."type" = 'adjustment' and "settlement_lines"."payment_attempt_id" is null and "settlement_lines"."refund_id" is null)),
	CONSTRAINT "settlement_lines_matched_target_present" CHECK ("settlement_lines"."match_status" <> 'matched'
        or ("settlement_lines"."type" = 'payment' and "settlement_lines"."payment_attempt_id" is not null)
        or ("settlement_lines"."type" = 'refund' and "settlement_lines"."refund_id" is not null)
        or "settlement_lines"."type" = 'adjustment')
);
--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_batch_store_fk" FOREIGN KEY ("batch_id","store_id") REFERENCES "public"."settlement_batches"("id","store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_line_store_fk" FOREIGN KEY ("settlement_line_id","store_id") REFERENCES "public"."settlement_lines"("id","store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_batch_store_fk" FOREIGN KEY ("batch_id","store_id") REFERENCES "public"."settlement_batches"("id","store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reconciliation_issues_store_status_idx" ON "reconciliation_issues" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "reconciliation_issues_batch_id_idx" ON "reconciliation_issues" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "settlement_batches_store_settled_at_idx" ON "settlement_batches" USING btree ("store_id","settled_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "settlement_batches_status_idx" ON "settlement_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "settlement_lines_batch_id_idx" ON "settlement_lines" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "settlement_lines_store_match_idx" ON "settlement_lines" USING btree ("store_id","match_status");--> statement-breakpoint
CREATE INDEX "settlement_lines_provider_transaction_idx" ON "settlement_lines" USING btree ("provider_transaction_id");