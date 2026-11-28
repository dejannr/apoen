CREATE OR REPLACE FUNCTION guard_banknote_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE'
     AND current_setting('apoen.allow_guest_transfer', true) = 'on'
     AND NEW.attempt_id IS NOT DISTINCT FROM OLD.attempt_id
     AND NEW.puzzle_guess_id IS NOT DISTINCT FROM OLD.puzzle_guess_id
     AND NEW.issue_no=OLD.issue_no AND NEW.season_id=OLD.season_id
     AND NEW.denomination=OLD.denomination AND NEW.earned_at=OLD.earned_at
     AND EXISTS (SELECT 1 FROM users WHERE id=OLD.user_id AND is_guest=true)
     AND EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND is_guest=false)
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Ledger and audit records are append-only';
END $$;
