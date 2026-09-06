CREATE TABLE "fiscal_periods" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fiscal_periods_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"soft_closed_by" integer,
	"soft_closed_at" timestamp with time zone,
	"closed_by" integer,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_periods_store_range_unique" UNIQUE("store_id","start_date","end_date"),
	CONSTRAINT "fiscal_periods_name_present" CHECK (nullif(btrim("fiscal_periods"."name"), '') is not null and char_length("fiscal_periods"."name") <= 100),
	CONSTRAINT "fiscal_periods_range_valid" CHECK ("fiscal_periods"."start_date" <= "fiscal_periods"."end_date"),
	CONSTRAINT "fiscal_periods_status_valid" CHECK ("fiscal_periods"."status" in ('open','soft_closed','closed')),
	CONSTRAINT "fiscal_periods_soft_close_evidence" CHECK (("fiscal_periods"."status" = 'open' and "fiscal_periods"."soft_closed_by" is null and "fiscal_periods"."soft_closed_at" is null) or ("fiscal_periods"."status" in ('soft_closed','closed') and "fiscal_periods"."soft_closed_by" is not null and "fiscal_periods"."soft_closed_at" is not null)),
	CONSTRAINT "fiscal_periods_close_evidence" CHECK (("fiscal_periods"."status" <> 'closed' and "fiscal_periods"."closed_by" is null and "fiscal_periods"."closed_at" is null) or ("fiscal_periods"."status" = 'closed' and "fiscal_periods"."closed_by" is not null and "fiscal_periods"."closed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "journal_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"journal_number" text NOT NULL,
	"business_date" date NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"event_type" text NOT NULL,
	"source_version" integer NOT NULL,
	"command_hash" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"posted_by" integer,
	"posted_at" timestamp with time zone,
	"reversal_of_journal_entry_id" integer,
	"reversal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_store_number_unique" UNIQUE("store_id","journal_number"),
	CONSTRAINT "journal_entries_source_identity_unique" UNIQUE("source_type","source_id","event_type","source_version"),
	CONSTRAINT "journal_entries_reversal_unique" UNIQUE("reversal_of_journal_entry_id"),
	CONSTRAINT "journal_entries_id_store_unique" UNIQUE("id","store_id"),
	CONSTRAINT "journal_entries_number_present" CHECK (nullif(btrim("journal_entries"."journal_number"), '') is not null and char_length("journal_entries"."journal_number") <= 100),
	CONSTRAINT "journal_entries_description_present" CHECK (nullif(btrim("journal_entries"."description"), '') is not null and char_length("journal_entries"."description") <= 500),
	CONSTRAINT "journal_entries_source_present" CHECK (nullif(btrim("journal_entries"."source_type"), '') is not null and nullif(btrim("journal_entries"."source_id"), '') is not null and nullif(btrim("journal_entries"."event_type"), '') is not null),
	CONSTRAINT "journal_entries_source_version_positive" CHECK ("journal_entries"."source_version" > 0),
	CONSTRAINT "journal_entries_command_hash_valid" CHECK ("journal_entries"."command_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "journal_entries_currency_inr" CHECK ("journal_entries"."currency" = 'INR'),
	CONSTRAINT "journal_entries_status_valid" CHECK ("journal_entries"."status" in ('draft','posted','reversed')),
	CONSTRAINT "journal_entries_posting_evidence" CHECK (("journal_entries"."status" = 'draft' and "journal_entries"."posted_at" is null) or ("journal_entries"."status" in ('posted','reversed') and "journal_entries"."posted_at" is not null)),
	CONSTRAINT "journal_entries_reversal_evidence" CHECK (("journal_entries"."reversal_of_journal_entry_id" is null and "journal_entries"."reversal_reason" is null) or ("journal_entries"."reversal_of_journal_entry_id" is not null and nullif(btrim("journal_entries"."reversal_reason"), '') is not null and "journal_entries"."status" = 'posted'))
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "journal_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"journal_entry_id" integer NOT NULL,
	"line_number" integer NOT NULL,
	"account_id" integer NOT NULL,
	"debit_paise" integer DEFAULT 0 NOT NULL,
	"credit_paise" integer DEFAULT 0 NOT NULL,
	"description" text,
	"order_id" integer,
	"payment_attempt_id" integer,
	"refund_id" integer,
	"expense_id" integer,
	"pay_run_id" integer,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_lines_entry_line_unique" UNIQUE("journal_entry_id","line_number"),
	CONSTRAINT "journal_lines_line_number_positive" CHECK ("journal_lines"."line_number" > 0),
	CONSTRAINT "journal_lines_exactly_one_side" CHECK (("journal_lines"."debit_paise" > 0 and "journal_lines"."credit_paise" = 0) or ("journal_lines"."credit_paise" > 0 and "journal_lines"."debit_paise" = 0)),
	CONSTRAINT "journal_lines_description_valid" CHECK ("journal_lines"."description" is null or (nullif(btrim("journal_lines"."description"), '') is not null and char_length("journal_lines"."description") <= 500))
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ledger_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"normal_side" text NOT NULL,
	"parent_id" integer,
	"currency" text DEFAULT 'INR' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_accounts_code_unique" UNIQUE("code"),
	CONSTRAINT "ledger_accounts_code_valid" CHECK ("ledger_accounts"."code" ~ '^[0-9]{4,10}$'),
	CONSTRAINT "ledger_accounts_name_present" CHECK (nullif(btrim("ledger_accounts"."name"), '') is not null and char_length("ledger_accounts"."name") <= 160),
	CONSTRAINT "ledger_accounts_type_valid" CHECK ("ledger_accounts"."type" in ('asset','liability','equity','revenue','expense','contra_revenue')),
	CONSTRAINT "ledger_accounts_normal_side_valid" CHECK ("ledger_accounts"."normal_side" in ('debit','credit')),
	CONSTRAINT "ledger_accounts_type_side_valid" CHECK (("ledger_accounts"."type" in ('asset','expense','contra_revenue') and "ledger_accounts"."normal_side" = 'debit') or ("ledger_accounts"."type" in ('liability','equity','revenue') and "ledger_accounts"."normal_side" = 'credit')),
	CONSTRAINT "ledger_accounts_currency_inr" CHECK ("ledger_accounts"."currency" = 'INR'),
	CONSTRAINT "ledger_accounts_parent_not_self" CHECK ("ledger_accounts"."parent_id" is null or "ledger_accounts"."parent_id" <> "ledger_accounts"."id")
);
--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_soft_closed_by_users_id_fk" FOREIGN KEY ("soft_closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_of_fk" FOREIGN KEY ("reversal_of_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fiscal_periods_store_dates_idx" ON "fiscal_periods" USING btree ("store_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "fiscal_periods_store_status_idx" ON "fiscal_periods" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "journal_entries_store_date_idx" ON "journal_entries" USING btree ("store_id","business_date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "journal_entries_store_status_idx" ON "journal_entries" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "journal_lines_account_entry_idx" ON "journal_lines" USING btree ("account_id","journal_entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_order_idx" ON "journal_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "journal_lines_payment_attempt_idx" ON "journal_lines" USING btree ("payment_attempt_id");--> statement-breakpoint
CREATE INDEX "journal_lines_refund_idx" ON "journal_lines" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "journal_lines_expense_idx" ON "journal_lines" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "ledger_accounts_parent_idx" ON "ledger_accounts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "ledger_accounts_active_code_idx" ON "ledger_accounts" USING btree ("is_active","code");--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_ledger_account_id_ledger_accounts_id_fk" FOREIGN KEY ("ledger_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_ledger_account_id_ledger_accounts_id_fk" FOREIGN KEY ("ledger_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;
+--> statement-breakpoint
INSERT INTO "ledger_accounts" ("code", "name", "type", "normal_side", "currency", "is_system", "is_active") VALUES
  ('1000', 'Cash on Hand', 'asset', 'debit', 'INR', true, true),
  ('1010', 'Bank', 'asset', 'debit', 'INR', true, true),
  ('1100', 'Razorpay Clearing', 'asset', 'debit', 'INR', true, true),
  ('1200', 'Inventory / COGS Clearing', 'asset', 'debit', 'INR', true, true),
  ('2000', 'Customer Advances / Order Clearing', 'liability', 'credit', 'INR', true, true),
  ('2100', 'Refunds Payable', 'liability', 'credit', 'INR', true, true),
  ('2200', 'Demo Tax Payable', 'liability', 'credit', 'INR', true, true),
  ('2300', 'Payroll Payable', 'liability', 'credit', 'INR', true, true),
  ('2310', 'Payroll Deductions Payable', 'liability', 'credit', 'INR', true, true),
  ('3000', 'Owner''s Equity / Opening Balance', 'equity', 'credit', 'INR', true, true),
  ('4000', 'Sales Revenue', 'revenue', 'credit', 'INR', true, true),
  ('4010', 'Delivery Revenue', 'revenue', 'credit', 'INR', true, true),
  ('4100', 'Discounts', 'contra_revenue', 'debit', 'INR', true, true),
  ('4110', 'Refunds', 'contra_revenue', 'debit', 'INR', true, true),
  ('5000', 'Cost of Goods Sold', 'expense', 'debit', 'INR', true, true),
  ('6000', 'Payment Gateway Fees', 'expense', 'debit', 'INR', true, true),
  ('6010', 'Gateway Fee Tax Expense', 'expense', 'debit', 'INR', true, true),
  ('6100', 'Cash Over / Short', 'expense', 'debit', 'INR', true, true),
  ('6200', 'Payroll Expense', 'expense', 'debit', 'INR', true, true),
  ('6900', 'Operating Expenses', 'expense', 'debit', 'INR', true, true),
  ('6990', 'Rounding Gain / Loss', 'expense', 'debit', 'INR', true, true);
