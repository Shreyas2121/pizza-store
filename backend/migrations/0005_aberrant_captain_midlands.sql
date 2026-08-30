-- PREFLIGHT CHECK (MANDATORY BEFORE RUNNING THIS MIGRATION):
-- Run the following query on the target database to ensure no duplicate accounts exist with differing email casing:
--
-- SELECT lower(email), count(*)
-- FROM users
-- GROUP BY lower(email)
-- HAVING count(*) > 1;
--
-- If this query returns any rows, accounts must be reconciled manually before applying this migration.

CREATE TABLE "store_memberships" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "store_memberships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"suspended_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_memberships_user_id_store_id_unique" UNIQUE("user_id","store_id"),
	CONSTRAINT "store_memberships_role_valid" CHECK ("store_memberships"."role" in ('manager', 'operator', 'inventory_staff')),
	CONSTRAINT "store_memberships_status_valid" CHECK ("store_memberships"."status" in ('active', 'suspended', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "store_staff_invitations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "store_staff_invitations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"email" text NOT NULL,
	"normalized_email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_staff_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "store_staff_invitations_role_valid" CHECK ("store_staff_invitations"."role" in ('manager', 'operator', 'inventory_staff')),
	CONSTRAINT "store_staff_invitations_token_hash_format" CHECK ("store_staff_invitations"."token_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_user_id" integer,
	"actor_email_snapshot" text,
	"platform_role" text,
	"store_id" integer,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"outcome" text DEFAULT 'success' NOT NULL,
	"request_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_outcome_valid" CHECK ("audit_logs"."outcome" in ('success', 'failure', 'denied'))
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_staff_invitations" ADD CONSTRAINT "store_staff_invitations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_staff_invitations" ADD CONSTRAINT "store_staff_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_memberships_user_status_store_idx" ON "store_memberships" USING btree ("user_id","status","store_id");--> statement-breakpoint
CREATE INDEX "store_memberships_store_status_role_idx" ON "store_memberships" USING btree ("store_id","status","role");--> statement-breakpoint
CREATE UNIQUE INDEX "store_staff_invitations_active_store_email_unique" ON "store_staff_invitations" USING btree ("store_id","normalized_email") WHERE "store_staff_invitations"."accepted_at" is null and "store_staff_invitations"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "audit_logs_store_created_at_idx" ON "audit_logs" USING btree ("store_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_at_idx" ON "audit_logs" USING btree ("actor_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs" USING btree ("action","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "users_lower_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_token_version_nonnegative" CHECK ("users"."token_version" >= 0);