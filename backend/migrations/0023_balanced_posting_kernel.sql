ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_reversal_evidence";--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_evidence" CHECK (("journal_entries"."reversal_of_journal_entry_id" is null and "journal_entries"."reversal_reason" is null) or ("journal_entries"."reversal_of_journal_entry_id" is not null and nullif(btrim("journal_entries"."reversal_reason"), '') is not null and "journal_entries"."status" in ('draft','posted')));
--> statement-breakpoint
CREATE FUNCTION "ledger_assert_journal_balance"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  line_count integer;
  debit_total bigint;
  credit_total bigint;
BEGIN
  IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
    SELECT count(*), coalesce(sum(debit_paise), 0), coalesce(sum(credit_paise), 0)
      INTO line_count, debit_total, credit_total
      FROM journal_lines
      WHERE journal_entry_id = NEW.id;
    IF line_count < 2 THEN
      RAISE EXCEPTION 'posted journal requires at least two lines' USING ERRCODE = '23514';
    END IF;
    IF debit_total <> credit_total THEN
      RAISE EXCEPTION 'posted journal debits and credits must balance' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "journal_entries_balance_before_post"
  BEFORE UPDATE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION "ledger_assert_journal_balance"();
--> statement-breakpoint
CREATE FUNCTION "ledger_protect_journal_entry"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'posted journal entries are immutable' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('posted', 'reversed') THEN
    IF OLD.status = 'posted'
       AND NEW.status = 'reversed'
       AND (to_jsonb(NEW) - ARRAY['status', 'updated_at']) = (to_jsonb(OLD) - ARRAY['status', 'updated_at']) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'posted journal entries are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "journal_entries_immutable"
  BEFORE UPDATE OR DELETE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION "ledger_protect_journal_entry"();
--> statement-breakpoint
CREATE FUNCTION "ledger_protect_journal_line"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status
    FROM journal_entries
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.journal_entry_id ELSE NEW.journal_entry_id END;
  IF parent_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'posted journal lines are immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "journal_lines_immutable"
  BEFORE INSERT OR UPDATE OR DELETE ON "journal_lines"
  FOR EACH ROW EXECUTE FUNCTION "ledger_protect_journal_line"();
--> statement-breakpoint
CREATE FUNCTION "ledger_protect_system_account"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_system THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'system ledger accounts cannot be deleted' USING ERRCODE = '55000';
    END IF;
    IF NEW.code <> OLD.code OR NEW.type <> OLD.type OR NEW.normal_side <> OLD.normal_side
       OR NEW.currency <> OLD.currency OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
       OR NEW.is_system IS DISTINCT FROM true OR NEW.is_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'system ledger account semantics are immutable' USING ERRCODE = '55000';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "ledger_accounts_protect_system"
  BEFORE UPDATE OR DELETE ON "ledger_accounts"
  FOR EACH ROW EXECUTE FUNCTION "ledger_protect_system_account"();
