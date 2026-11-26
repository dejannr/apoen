CREATE OR REPLACE FUNCTION guard_terminal_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'ACTIVE' THEN
    IF current_setting('apoen.allow_guest_transfer', true) = 'on'
       AND NEW.user_id <> OLD.user_id
       AND (to_jsonb(NEW) - 'user_id') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'user_id')
       AND EXISTS (SELECT 1 FROM users WHERE id=OLD.user_id AND is_guest=true)
       AND EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND is_guest=false)
    THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Terminal attempts cannot be changed';
  END IF;
  IF NEW.status='ACTIVE' AND (NEW.final_reward IS NOT NULL OR NEW.finished_at IS NOT NULL OR NEW.end_reason IS NOT NULL) THEN RAISE EXCEPTION 'Active attempts cannot have a result'; END IF;
  IF NEW.status<>'ACTIVE' AND (NEW.final_reward IS NULL OR NEW.finished_at IS NULL OR NEW.end_reason IS NULL) THEN RAISE EXCEPTION 'Terminal attempts require a final result'; END IF;
  IF NEW.final_reward NOT IN (0,10,20,50,100,200,500,1000,2000,5000) THEN RAISE EXCEPTION 'Invalid attempt reward'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER banknotes_append_only ON banknotes;
CREATE OR REPLACE FUNCTION guard_banknote_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE'
     AND current_setting('apoen.allow_guest_transfer', true) = 'on'
     AND NEW.attempt_id=OLD.attempt_id AND NEW.season_id=OLD.season_id
     AND NEW.denomination=OLD.denomination AND NEW.earned_at=OLD.earned_at
     AND EXISTS (SELECT 1 FROM users WHERE id=OLD.user_id AND is_guest=true)
     AND EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND is_guest=false)
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Ledger and audit records are append-only';
END $$;
CREATE TRIGGER banknotes_append_only BEFORE UPDATE OR DELETE ON banknotes FOR EACH ROW EXECUTE FUNCTION guard_banknote_transfer();
