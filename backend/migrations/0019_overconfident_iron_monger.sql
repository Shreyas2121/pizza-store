CREATE TABLE "expense_categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer,
	"parent_id" integer,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"classification" text NOT NULL,
	"ledger_account_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"updated_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_present" CHECK (nullif(btrim("expense_categories"."name"), '') is not null and char_length("expense_categories"."name") <= 120),
	CONSTRAINT "expense_categories_normalized_name_present" CHECK (nullif(btrim("expense_categories"."normalized_name"), '') is not null and char_length("expense_categories"."normalized_name") <= 120),
	CONSTRAINT "expense_categories_classification_valid" CHECK ("expense_categories"."classification" in ('fixed', 'variable')),
	CONSTRAINT "expense_categories_parent_not_self" CHECK ("expense_categories"."parent_id" is null or "expense_categories"."parent_id" <> "expense_categories"."id"),
	CONSTRAINT "expense_categories_ledger_account_positive" CHECK ("expense_categories"."ledger_account_id" is null or "expense_categories"."ledger_account_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"tax_registration_number" text,
	"contact_name" text,
	"email" text,
	"phone" text,
	"address" text,
	"payment_terms_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"updated_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_name_present" CHECK (nullif(btrim("vendors"."name"), '') is not null and char_length("vendors"."name") <= 200),
	CONSTRAINT "vendors_normalized_name_present" CHECK (nullif(btrim("vendors"."normalized_name"), '') is not null and char_length("vendors"."normalized_name") <= 200),
	CONSTRAINT "vendors_payment_terms_valid" CHECK ("vendors"."payment_terms_days" between 0 and 3650)
);
--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_store_parent_name_unique" ON "expense_categories" USING btree ("store_id","parent_id","normalized_name") WHERE "expense_categories"."store_id" is not null and "expense_categories"."parent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_store_root_name_unique" ON "expense_categories" USING btree ("store_id","normalized_name") WHERE "expense_categories"."store_id" is not null and "expense_categories"."parent_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_platform_parent_name_unique" ON "expense_categories" USING btree ("parent_id","normalized_name") WHERE "expense_categories"."store_id" is null and "expense_categories"."parent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_platform_root_name_unique" ON "expense_categories" USING btree ("normalized_name") WHERE "expense_categories"."store_id" is null and "expense_categories"."parent_id" is null;--> statement-breakpoint
CREATE INDEX "expense_categories_store_active_name_idx" ON "expense_categories" USING btree ("store_id","is_active","normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_store_normalized_name_unique" ON "vendors" USING btree ("store_id","normalized_name") WHERE "vendors"."store_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_platform_normalized_name_unique" ON "vendors" USING btree ("normalized_name") WHERE "vendors"."store_id" is null;--> statement-breakpoint
CREATE INDEX "vendors_store_active_name_idx" ON "vendors" USING btree ("store_id","is_active","normalized_name");