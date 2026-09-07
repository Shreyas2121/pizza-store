CREATE TABLE "pay_run_commands" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pay_run_commands_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"pay_run_id" integer NOT NULL,
	"action" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"result_version" integer NOT NULL,
	"actor_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pay_run_commands_idempotency_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "pay_run_commands_action_valid" CHECK ("pay_run_commands"."action" in ('calculate', 'approve', 'pay', 'void')),
	CONSTRAINT "pay_run_commands_key_uuid" CHECK ("pay_run_commands"."idempotency_key" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "pay_run_commands_payload_hash" CHECK ("pay_run_commands"."payload_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "pay_run_commands_result_version_positive" CHECK ("pay_run_commands"."result_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "pay_run_employees" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pay_run_employees_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"pay_run_id" integer NOT NULL,
	"pay_run_store_id" integer NOT NULL,
	"profile_id" integer NOT NULL,
	"compensation_version_id" integer NOT NULL,
	"employee_code" text NOT NULL,
	"display_name" text NOT NULL,
	"gross_pay_paise" integer NOT NULL,
	"deduction_paise" integer NOT NULL,
	"net_pay_paise" integer NOT NULL,
	"employer_cost_paise" integer NOT NULL,
	"total_employer_cost_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pay_run_employees_run_profile_unique" UNIQUE("pay_run_id","profile_id"),
	CONSTRAINT "pay_run_employees_code_present" CHECK (nullif(btrim("pay_run_employees"."employee_code"), '') is not null and char_length("pay_run_employees"."employee_code") <= 40),
	CONSTRAINT "pay_run_employees_name_present" CHECK (nullif(btrim("pay_run_employees"."display_name"), '') is not null and char_length("pay_run_employees"."display_name") <= 160),
	CONSTRAINT "pay_run_employees_totals_valid" CHECK ("pay_run_employees"."gross_pay_paise" >= 0 and "pay_run_employees"."deduction_paise" >= 0 and "pay_run_employees"."net_pay_paise" >= 0 and "pay_run_employees"."employer_cost_paise" >= 0 and "pay_run_employees"."total_employer_cost_paise" >= 0 and "pay_run_employees"."net_pay_paise" = "pay_run_employees"."gross_pay_paise" - "pay_run_employees"."deduction_paise" and "pay_run_employees"."total_employer_cost_paise" = "pay_run_employees"."gross_pay_paise" + "pay_run_employees"."employer_cost_paise")
);
--> statement-breakpoint
CREATE TABLE "pay_run_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pay_run_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"pay_run_employee_id" integer NOT NULL,
	"compensation_component_id" integer NOT NULL,
	"type" text NOT NULL,
	"component_code" text NOT NULL,
	"component_name" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pay_run_lines_employee_type_code_unique" UNIQUE("pay_run_employee_id","type","component_code"),
	CONSTRAINT "pay_run_lines_type_valid" CHECK ("pay_run_lines"."type" in ('earning', 'deduction', 'employer_cost')),
	CONSTRAINT "pay_run_lines_code_present" CHECK (nullif(btrim("pay_run_lines"."component_code"), '') is not null and char_length("pay_run_lines"."component_code") <= 40),
	CONSTRAINT "pay_run_lines_name_present" CHECK (nullif(btrim("pay_run_lines"."component_name"), '') is not null and char_length("pay_run_lines"."component_name") <= 120),
	CONSTRAINT "pay_run_lines_amount_positive" CHECK ("pay_run_lines"."amount_paise" > 0 and "pay_run_lines"."amount_paise" <= 100000000)
);
--> statement-breakpoint
CREATE TABLE "pay_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pay_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"demo_only" boolean DEFAULT true NOT NULL,
	"employee_count" integer,
	"gross_pay_paise" integer,
	"deduction_paise" integer,
	"net_pay_paise" integer,
	"employer_cost_paise" integer,
	"total_employer_cost_paise" integer,
	"client_request_id" text NOT NULL,
	"payload_hash" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" integer,
	"calculated_by" integer,
	"calculated_at" timestamp with time zone,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"paid_by" integer,
	"paid_at" timestamp with time zone,
	"payment_reference" text,
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
	CONSTRAINT "pay_runs_id_store_unique" UNIQUE("id","store_id"),
	CONSTRAINT "pay_runs_store_period_unique" UNIQUE("store_id","period_start","period_end"),
	CONSTRAINT "pay_runs_client_request_unique" UNIQUE("client_request_id"),
	CONSTRAINT "pay_runs_period_valid" CHECK ("pay_runs"."period_start" <= "pay_runs"."period_end"),
	CONSTRAINT "pay_runs_monthly_period" CHECK ("pay_runs"."period_start" = date_trunc('month', "pay_runs"."period_start")::date and "pay_runs"."period_end" = (date_trunc('month', "pay_runs"."period_start") + interval '1 month - 1 day')::date),
	CONSTRAINT "pay_runs_status_valid" CHECK ("pay_runs"."status" in ('draft', 'calculated', 'approved', 'paid', 'posted', 'voided', 'reversed')),
	CONSTRAINT "pay_runs_currency_inr" CHECK ("pay_runs"."currency" = 'INR'),
	CONSTRAINT "pay_runs_demo_only" CHECK ("pay_runs"."demo_only" = true),
	CONSTRAINT "pay_runs_version_positive" CHECK ("pay_runs"."version" > 0),
	CONSTRAINT "pay_runs_request_uuid" CHECK ("pay_runs"."client_request_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "pay_runs_payload_hash" CHECK ("pay_runs"."payload_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "pay_runs_totals_complete" CHECK (("pay_runs"."employee_count" is null and "pay_runs"."gross_pay_paise" is null and "pay_runs"."deduction_paise" is null and "pay_runs"."net_pay_paise" is null and "pay_runs"."employer_cost_paise" is null and "pay_runs"."total_employer_cost_paise" is null) or ("pay_runs"."employee_count" > 0 and "pay_runs"."gross_pay_paise" >= 0 and "pay_runs"."deduction_paise" >= 0 and "pay_runs"."net_pay_paise" >= 0 and "pay_runs"."employer_cost_paise" >= 0 and "pay_runs"."total_employer_cost_paise" >= 0 and "pay_runs"."net_pay_paise" = "pay_runs"."gross_pay_paise" - "pay_runs"."deduction_paise" and "pay_runs"."total_employer_cost_paise" = "pay_runs"."gross_pay_paise" + "pay_runs"."employer_cost_paise")),
	CONSTRAINT "pay_runs_calculation_evidence" CHECK ("pay_runs"."status" in ('draft', 'voided') or ("pay_runs"."calculated_by" is not null and "pay_runs"."calculated_at" is not null and "pay_runs"."employee_count" is not null)),
	CONSTRAINT "pay_runs_approval_evidence" CHECK ("pay_runs"."status" not in ('approved', 'paid', 'posted', 'reversed') or ("pay_runs"."approved_by" is not null and "pay_runs"."approved_at" is not null)),
	CONSTRAINT "pay_runs_payment_evidence" CHECK ("pay_runs"."status" not in ('paid', 'posted', 'reversed') or ("pay_runs"."paid_by" is not null and "pay_runs"."paid_at" is not null and nullif(btrim("pay_runs"."payment_reference"), '') is not null)),
	CONSTRAINT "pay_runs_posting_evidence" CHECK ("pay_runs"."status" not in ('posted', 'reversed') or ("pay_runs"."posted_by" is not null and "pay_runs"."posted_at" is not null)),
	CONSTRAINT "pay_runs_void_evidence" CHECK ("pay_runs"."status" <> 'voided' or ("pay_runs"."voided_by" is not null and "pay_runs"."voided_at" is not null and nullif(btrim("pay_runs"."void_reason"), '') is not null)),
	CONSTRAINT "pay_runs_reversal_evidence" CHECK ("pay_runs"."status" <> 'reversed' or ("pay_runs"."reversed_by" is not null and "pay_runs"."reversed_at" is not null and nullif(btrim("pay_runs"."reversal_reason"), '') is not null))
);
--> statement-breakpoint
ALTER TABLE "pay_run_commands" ADD CONSTRAINT "pay_run_commands_pay_run_id_pay_runs_id_fk" FOREIGN KEY ("pay_run_id") REFERENCES "public"."pay_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run_commands" ADD CONSTRAINT "pay_run_commands_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run_employees" ADD CONSTRAINT "pay_run_employees_run_store_fk" FOREIGN KEY ("pay_run_id","pay_run_store_id") REFERENCES "public"."pay_runs"("id","store_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run_employees" ADD CONSTRAINT "pay_run_employees_profile_store_fk" FOREIGN KEY ("profile_id","pay_run_store_id") REFERENCES "public"."employee_finance_profiles"("id","store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run_employees" ADD CONSTRAINT "pay_run_employees_compensation_profile_store_fk" FOREIGN KEY ("compensation_version_id","profile_id","pay_run_store_id") REFERENCES "public"."compensation_versions"("id","profile_id","store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run_lines" ADD CONSTRAINT "pay_run_lines_pay_run_employee_id_pay_run_employees_id_fk" FOREIGN KEY ("pay_run_employee_id") REFERENCES "public"."pay_run_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run_lines" ADD CONSTRAINT "pay_run_lines_compensation_component_id_compensation_components_id_fk" FOREIGN KEY ("compensation_component_id") REFERENCES "public"."compensation_components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_calculated_by_users_id_fk" FOREIGN KEY ("calculated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pay_run_commands_run_action_idx" ON "pay_run_commands" USING btree ("pay_run_id","action","id");--> statement-breakpoint
CREATE INDEX "pay_run_employees_run_idx" ON "pay_run_employees" USING btree ("pay_run_id","id");--> statement-breakpoint
CREATE INDEX "pay_run_lines_employee_idx" ON "pay_run_lines" USING btree ("pay_run_employee_id","type","id");--> statement-breakpoint
CREATE INDEX "pay_runs_store_period_status_idx" ON "pay_runs" USING btree ("store_id","period_start","period_end","status");--> statement-breakpoint
ALTER TABLE "compensation_versions" ADD CONSTRAINT "compensation_versions_id_profile_store_unique" UNIQUE("id","profile_id","store_id");