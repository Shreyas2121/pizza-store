CREATE TABLE "cash_movements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"session_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"order_id" integer,
	"refund_id" integer,
	"reverses_movement_id" integer,
	"reason" text,
	"recorded_by" integer,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_movements_order_unique" UNIQUE("order_id"),
	CONSTRAINT "cash_movements_refund_unique" UNIQUE("refund_id"),
	CONSTRAINT "cash_movements_reversal_unique" UNIQUE("reverses_movement_id"),
	CONSTRAINT "cash_movements_type_valid" CHECK ("cash_movements"."type" in ('cod_collection', 'refund', 'cash_in', 'cash_out', 'deposit', 'adjustment')),
	CONSTRAINT "cash_movements_amount_nonzero" CHECK ("cash_movements"."amount_paise" <> 0),
	CONSTRAINT "cash_movements_source_valid" CHECK (("cash_movements"."type" = 'cod_collection' and "cash_movements"."order_id" is not null and "cash_movements"."refund_id" is null and "cash_movements"."amount_paise" > 0) or ("cash_movements"."type" = 'refund' and "cash_movements"."refund_id" is not null and "cash_movements"."order_id" is null and "cash_movements"."amount_paise" < 0) or ("cash_movements"."type" in ('cash_in', 'cash_out', 'deposit', 'adjustment') and "cash_movements"."order_id" is null and "cash_movements"."refund_id" is null)),
	CONSTRAINT "cash_movements_manual_reason" CHECK ("cash_movements"."type" in ('cod_collection', 'refund') or (nullif(btrim("cash_movements"."reason"), '') is not null and char_length("cash_movements"."reason") <= 1000)),
	CONSTRAINT "cash_movements_manual_direction" CHECK (("cash_movements"."type" = 'cash_in' and "cash_movements"."amount_paise" > 0) or ("cash_movements"."type" in ('cash_out', 'deposit') and "cash_movements"."amount_paise" < 0) or "cash_movements"."type" not in ('cash_in', 'cash_out', 'deposit'))
);
--> statement-breakpoint
CREATE TABLE "cash_session_closures" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_session_closures_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"session_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"session_version" integer NOT NULL,
	"expected_cash_paise" integer NOT NULL,
	"counted_cash_paise" integer NOT NULL,
	"variance_paise" integer NOT NULL,
	"material_variance_acknowledged" boolean DEFAULT false NOT NULL,
	"closed_by" integer NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"reversed_by" integer,
	"reversed_at" timestamp with time zone,
	"reversal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_session_closures_session_version_unique" UNIQUE("session_id","session_version"),
	CONSTRAINT "cash_session_closures_version_positive" CHECK ("cash_session_closures"."session_version" > 0),
	CONSTRAINT "cash_session_closures_amounts_valid" CHECK ("cash_session_closures"."expected_cash_paise" >= 0 and "cash_session_closures"."counted_cash_paise" >= 0 and "cash_session_closures"."variance_paise" = "cash_session_closures"."counted_cash_paise" - "cash_session_closures"."expected_cash_paise"),
	CONSTRAINT "cash_session_closures_reversal_evidence" CHECK (("cash_session_closures"."reversed_at" is null and "cash_session_closures"."reversed_by" is null and "cash_session_closures"."reversal_reason" is null) or ("cash_session_closures"."reversed_at" is not null and "cash_session_closures"."reversed_by" is not null and nullif(btrim("cash_session_closures"."reversal_reason"), '') is not null))
);
--> statement-breakpoint
CREATE TABLE "cash_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"business_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"opening_float_paise" integer NOT NULL,
	"expected_cash_paise" integer NOT NULL,
	"counted_cash_paise" integer,
	"variance_paise" integer,
	"material_variance_acknowledged" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"opened_by" integer NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_by" integer,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_sessions_store_business_date_unique" UNIQUE("store_id","business_date"),
	CONSTRAINT "cash_sessions_id_store_unique" UNIQUE("id","store_id"),
	CONSTRAINT "cash_sessions_status_valid" CHECK ("cash_sessions"."status" in ('open', 'closed')),
	CONSTRAINT "cash_sessions_currency_inr" CHECK ("cash_sessions"."currency" = 'INR'),
	CONSTRAINT "cash_sessions_amounts_valid" CHECK ("cash_sessions"."opening_float_paise" >= 0 and "cash_sessions"."expected_cash_paise" >= 0 and ("cash_sessions"."counted_cash_paise" is null or "cash_sessions"."counted_cash_paise" >= 0)),
	CONSTRAINT "cash_sessions_version_positive" CHECK ("cash_sessions"."version" > 0),
	CONSTRAINT "cash_sessions_close_evidence" CHECK (("cash_sessions"."status" = 'open' and "cash_sessions"."counted_cash_paise" is null and "cash_sessions"."variance_paise" is null and "cash_sessions"."closed_by" is null and "cash_sessions"."closed_at" is null) or ("cash_sessions"."status" = 'closed' and "cash_sessions"."counted_cash_paise" is not null and "cash_sessions"."variance_paise" = "cash_sessions"."counted_cash_paise" - "cash_sessions"."expected_cash_paise" and "cash_sessions"."closed_by" is not null and "cash_sessions"."closed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_session_store_fk" FOREIGN KEY ("session_id","store_id") REFERENCES "public"."cash_sessions"("id","store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session_closures" ADD CONSTRAINT "cash_session_closures_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session_closures" ADD CONSTRAINT "cash_session_closures_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session_closures" ADD CONSTRAINT "cash_session_closures_session_store_fk" FOREIGN KEY ("session_id","store_id") REFERENCES "public"."cash_sessions"("id","store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_movements_session_occurred_idx" ON "cash_movements" USING btree ("session_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "cash_session_closures_session_idx" ON "cash_session_closures" USING btree ("session_id","closed_at");--> statement-breakpoint
CREATE INDEX "cash_sessions_store_status_date_idx" ON "cash_sessions" USING btree ("store_id","status","business_date");