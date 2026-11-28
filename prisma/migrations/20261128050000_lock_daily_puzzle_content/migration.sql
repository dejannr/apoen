CREATE OR REPLACE FUNCTION guard_daily_puzzle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid; st "SetStatus"; puzzle_date date;
BEGIN
  sid := CASE WHEN TG_OP='DELETE' THEN OLD.daily_set_id ELSE NEW.daily_set_id END;
  SELECT status,play_date INTO st,puzzle_date FROM daily_sets WHERE id=sid FOR UPDATE;
  IF st IS NULL OR st='CANCELLED' THEN RAISE EXCEPTION 'Puzzle requires an active daily set'; END IF;
  IF st='PUBLISHED' AND puzzle_date < (clock_timestamp() AT TIME ZONE 'Europe/Belgrade')::date THEN RAISE EXCEPTION 'Past daily puzzle content is immutable'; END IF;
  IF st<>'DRAFT' AND (EXISTS(SELECT 1 FROM attempts a JOIN challenges c ON c.id=a.challenge_id WHERE c.daily_set_id=sid) OR EXISTS(SELECT 1 FROM daily_puzzle_guesses g WHERE g.daily_set_id=sid)) THEN
    RAISE EXCEPTION 'Played daily puzzle content is immutable';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
