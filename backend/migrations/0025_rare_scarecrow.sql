CREATE TABLE "compensation_components" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "compensation_components_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"compensation_version_id" integer NOT NULL,
	"type" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compensation_components_version_type_code_unique" UNIQUE("compensation_version_id","type","code"),
	CONSTRAINT "compensation_components_type_valid" CHECK ("compensation_components"."type" in ('earning', 'deduction', 'employer_cost')),
	CONSTRAINT "compensation_components_code_valid" CHECK ("compensation_components"."code" ~ '^[A-Z][A-Z0-9_]{1,39}$'),
	CONSTRAINT "compensation_components_name_present" CHECK (nullif(btrim("compensation_components"."name"), '') is not null and char_length("compensation_components"."name") <= 120),
	CONSTRAINT "compensation_components_amount_positive" CHECK ("compensation_components"."amount_paise" > 0 and "compensation_components"."amount_paise" <= 100000000)
);
--> statement-breakpoint
CREATE TABLE "compensation_versions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "compensation_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"profile_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"currency" text DEFAULT 'INR' NOT NULL,
	"source_note" text,
	"demo_only" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compensation_versions_profile_from_unique" UNIQUE("profile_id","effective_from"),
	CONSTRAINT "compensation_versions_range_valid" CHECK ("compensation_versions"."effective_to" is null or "compensation_versions"."effective_to" >= "compensation_versions"."effective_from"),
	CONSTRAINT "compensation_versions_currency_inr" CHECK ("compensation_versions"."currency" = 'INR'),
	CONSTRAINT "compensation_versions_demo_only" CHECK ("compensation_versions"."demo_only" = true),
	CONSTRAINT "compensation_versions_source_note_length" CHECK ("compensation_versions"."source_note" is null or char_length("compensation_versions"."source_note") <= 500)
);
--> statement-breakpoint
CREATE TABLE "employee_finance_profiles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_finance_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"user_id" integer,
	"employee_code" text NOT NULL,
	"display_name" text NOT NULL,
	"employment_start_date" date NOT NULL,
	"employment_end_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"pay_frequency" text DEFAULT 'monthly' NOT NULL,
	"bank_account_encrypted" text,
	"bank_account_last4" text,
	"tax_identifier_encrypted" text,
	"tax_identifier_last4" text,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_finance_profiles_id_store_unique" UNIQUE("id","store_id"),
	CONSTRAINT "employee_finance_profiles_store_code_unique" UNIQUE("store_id","employee_code"),
	CONSTRAINT "employee_finance_profiles_code_present" CHECK (nullif(btrim("employee_finance_profiles"."employee_code"), '') is not null and char_length("employee_finance_profiles"."employee_code") <= 40),
	CONSTRAINT "employee_finance_profiles_name_present" CHECK (nullif(btrim("employee_finance_profiles"."display_name"), '') is not null and char_length("employee_finance_profiles"."display_name") <= 160),
	CONSTRAINT "employee_finance_profiles_dates_valid" CHECK ("employee_finance_profiles"."employment_end_date" is null or "employee_finance_profiles"."employment_end_date" >= "employee_finance_profiles"."employment_start_date"),
	CONSTRAINT "employee_finance_profiles_status_valid" CHECK ("employee_finance_profiles"."status" in ('active', 'on_leave', 'terminated')),
	CONSTRAINT "employee_finance_profiles_terminated_date" CHECK ("employee_finance_profiles"."status" <> 'terminated' or "employee_finance_profiles"."employment_end_date" is not null),
	CONSTRAINT "employee_finance_profiles_frequency_valid" CHECK ("employee_finance_profiles"."pay_frequency" = 'monthly'),
	CONSTRAINT "employee_finance_profiles_bank_pair" CHECK (("employee_finance_profiles"."bank_account_encrypted" is null) = ("employee_finance_profiles"."bank_account_last4" is null)),
	CONSTRAINT "employee_finance_profiles_tax_pair" CHECK (("employee_finance_profiles"."tax_identifier_encrypted" is null) = ("employee_finance_profiles"."tax_identifier_last4" is null)),
	CONSTRAINT "employee_finance_profiles_bank_last4" CHECK ("employee_finance_profiles"."bank_account_last4" is null or "employee_finance_profiles"."bank_account_last4" ~ '^[A-Za-z0-9]{4}$'),
	CONSTRAINT "employee_finance_profiles_tax_last4" CHECK ("employee_finance_profiles"."tax_identifier_last4" is null or "employee_finance_profiles"."tax_identifier_last4" ~ '^[A-Za-z0-9]{4}$')
);
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint
ALTER TABLE "compensation_versions" ADD CONSTRAINT "compensation_versions_no_overlap" EXCLUDE USING gist (
	"profile_id" WITH =,
	daterange("effective_from", COALESCE("effective_to", 'infinity'::date), '[]') WITH &&
);--> statement-breakpoint
ALTER TABLE "compensation_components" ADD CONSTRAINT "compensation_components_compensation_version_id_compensation_versions_id_fk" FOREIGN KEY ("compensation_version_id") REFERENCES "public"."compensation_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_versions" ADD CONSTRAINT "compensation_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_versions" ADD CONSTRAINT "compensation_versions_profile_store_fk" FOREIGN KEY ("profile_id","store_id") REFERENCES "public"."employee_finance_profiles"("id","store_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_finance_profiles" ADD CONSTRAINT "employee_finance_profiles_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_finance_profiles" ADD CONSTRAINT "employee_finance_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_finance_profiles" ADD CONSTRAINT "employee_finance_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_finance_profiles" ADD CONSTRAINT "employee_finance_profiles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compensation_components_version_idx" ON "compensation_components" USING btree ("compensation_version_id","type","id");--> statement-breakpoint
CREATE INDEX "compensation_versions_profile_effective_idx" ON "compensation_versions" USING btree ("profile_id","effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_finance_profiles_store_user_unique" ON "employee_finance_profiles" USING btree ("store_id","user_id") WHERE "employee_finance_profiles"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "employee_finance_profiles_store_status_idx" ON "employee_finance_profiles" USING btree ("store_id","status","display_name");
