CREATE TABLE "expense_attachments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_attachments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"expense_id" integer NOT NULL,
	"expense_store_id" integer NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"media_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_attachments_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "expense_attachments_expense_sha_unique" UNIQUE("expense_id","sha256"),
	CONSTRAINT "expense_attachments_storage_key_safe" CHECK ("expense_attachments"."storage_key" ~ '^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'),
	CONSTRAINT "expense_attachments_original_name_valid" CHECK (nullif(btrim("expense_attachments"."original_name"), '') is not null and char_length("expense_attachments"."original_name") <= 255),
	CONSTRAINT "expense_attachments_media_type_valid" CHECK ("expense_attachments"."media_type" in ('application/pdf','image/jpeg','image/png','image/webp')),
	CONSTRAINT "expense_attachments_size_valid" CHECK ("expense_attachments"."size_bytes" > 0 and "expense_attachments"."size_bytes" <= 5242880),
	CONSTRAINT "expense_attachments_sha256_valid" CHECK ("expense_attachments"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_expense_store_fk" FOREIGN KEY ("expense_id","expense_store_id") REFERENCES "public"."expenses"("id","store_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_attachments_expense_idx" ON "expense_attachments" USING btree ("expense_id","id");