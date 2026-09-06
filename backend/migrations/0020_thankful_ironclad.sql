CREATE TABLE "expense_allocations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_allocations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"expense_id" integer NOT NULL,
	"expense_store_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"category_name" text NOT NULL,
	"category_classification" text NOT NULL,
	"ledger_account_id" integer,
	"cost_center" text,
	"amount_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_allocations_amount_positive" CHECK ("expense_allocations"."amount_paise" > 0 and "expense_allocations"."amount_paise" <= 50000000),
	CONSTRAINT "expense_allocations_category_snapshot_valid" CHECK (nullif(btrim("expense_allocations"."category_name"), '') is not null and "expense_allocations"."category_classification" in ('fixed','variable')),
	CONSTRAINT "expense_allocations_cost_center_valid" CHECK ("expense_allocations"."cost_center" is null or (nullif(btrim("expense_allocations"."cost_center"), '') is not null and char_length("expense_allocations"."cost_center") <= 120)),
	CONSTRAINT "expense_allocations_ledger_account_positive" CHECK ("expense_allocations"."ledger_account_id" is null or "expense_allocations"."ledger_account_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "expense_commands" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_commands_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"expense_id" integer NOT NULL,
	"action" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"result_version" integer NOT NULL,
	"actor_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_commands_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "expense_commands_action_valid" CHECK ("expense_commands"."action" in ('submit','approve','reject','pay','post','void','reverse')),
	CONSTRAINT "expense_commands_payload_hash_valid" CHECK ("expense_commands"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "expense_commands_result_version_positive" CHECK ("expense_commands"."result_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"vendor_id" integer,
	"vendor_name" text,
	"expense_date" date NOT NULL,
	"description" text NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"tax_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"payment_method" text,
	"payment_reference" text,
	"client_request_id" text NOT NULL,
	"payload_hash" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" integer NOT NULL,
	"updated_by" integer NOT NULL,
	"submitted_by" integer,
	"submitted_at" timestamp with time zone,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"rejected_by" integer,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"paid_by" integer,
	"paid_at" timestamp with time zone,
	"posted_by" integer,
	"posted_at" timestamp with time zone,
	"voided_by" integer,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"reversed_by" integer,
	"reversed_at" timestamp with time zone,
	"reversal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_client_request_id_unique" UNIQUE("client_request_id"),
	CONSTRAINT "expenses_id_store_unique" UNIQUE("id","store_id"),
	CONSTRAINT "expenses_status_valid" CHECK ("expenses"."status" in ('draft','submitted','approved','paid','posted','rejected','voided','reversed')),
	CONSTRAINT "expenses_currency_inr" CHECK ("expenses"."currency" = 'INR'),
	CONSTRAINT "expenses_amounts_valid" CHECK ("expenses"."subtotal_paise" >= 0 and "expenses"."tax_paise" >= 0 and "expenses"."total_paise" > 0 and "expenses"."total_paise" <= 50000000 and "expenses"."total_paise"::bigint = "expenses"."subtotal_paise"::bigint + "expenses"."tax_paise"::bigint),
	CONSTRAINT "expenses_description_present" CHECK (nullif(btrim("expenses"."description"), '') is not null and char_length("expenses"."description") <= 1000),
	CONSTRAINT "expenses_payload_hash_valid" CHECK ("expenses"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "expenses_version_positive" CHECK ("expenses"."version" > 0),
	CONSTRAINT "expenses_payment_method_valid" CHECK ("expenses"."payment_method" is null or "expenses"."payment_method" in ('bank_transfer','cash','card','upi','other')),
	CONSTRAINT "expenses_submission_evidence" CHECK (("expenses"."status" not in ('submitted','approved','paid','posted','rejected','reversed')) or ("expenses"."submitted_by" is not null and "expenses"."submitted_at" is not null)),
	CONSTRAINT "expenses_payment_evidence" CHECK (("expenses"."status" not in ('paid','posted','reversed')) or ("expenses"."paid_by" is not null and "expenses"."paid_at" is not null and "expenses"."payment_method" is not null)),
	CONSTRAINT "expenses_approval_evidence" CHECK (("expenses"."status" not in ('approved','paid','posted','reversed')) or ("expenses"."approved_by" is not null and "expenses"."approved_at" is not null)),
	CONSTRAINT "expenses_rejection_evidence" CHECK (("expenses"."status" <> 'rejected') or ("expenses"."rejected_by" is not null and "expenses"."rejected_at" is not null and nullif(btrim("expenses"."rejection_reason"), '') is not null)),
	CONSTRAINT "expenses_posting_evidence" CHECK (("expenses"."status" not in ('posted','reversed')) or ("expenses"."posted_by" is not null and "expenses"."posted_at" is not null)),
	CONSTRAINT "expenses_void_evidence" CHECK (("expenses"."status" <> 'voided') or ("expenses"."voided_by" is not null and "expenses"."voided_at" is not null and nullif(btrim("expenses"."void_reason"), '') is not null)),
	CONSTRAINT "expenses_reversal_evidence" CHECK (("expenses"."status" <> 'reversed') or ("expenses"."reversed_by" is not null and "expenses"."reversed_at" is not null and nullif(btrim("expenses"."reversal_reason"), '') is not null))
);
--> statement-breakpoint
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_expense_store_fk" FOREIGN KEY ("expense_id","expense_store_id") REFERENCES "public"."expenses"("id","store_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_commands" ADD CONSTRAINT "expense_commands_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_commands" ADD CONSTRAINT "expense_commands_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_allocations_store_category_idx" ON "expense_allocations" USING btree ("store_id","category_id");--> statement-breakpoint
CREATE INDEX "expense_commands_expense_idx" ON "expense_commands" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "expenses_store_date_idx" ON "expenses" USING btree ("store_id","expense_date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "expenses_store_status_idx" ON "expenses" USING btree ("store_id","status");