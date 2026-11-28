ALTER TABLE attempts ADD COLUMN joker_used BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE banknotes DROP CONSTRAINT banknotes_attempt_id_user_id_season_id_fkey;
DROP INDEX banknotes_attempt_id_key;
DROP INDEX banknotes_attempt_id_user_id_season_id_key;
ALTER TABLE banknotes ALTER COLUMN attempt_id DROP NOT NULL;
ALTER TABLE banknotes ADD COLUMN puzzle_guess_id UUID;
ALTER TABLE banknotes ADD COLUMN issue_no INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX banknotes_attempt_id_issue_no_key ON banknotes(attempt_id, issue_no);
CREATE UNIQUE INDEX banknotes_puzzle_guess_id_key ON banknotes(puzzle_guess_id);
ALTER TABLE banknotes ADD CONSTRAINT banknotes_origin_check CHECK (num_nonnulls(attempt_id,puzzle_guess_id)=1 AND issue_no >= 1);
ALTER TABLE banknotes ADD CONSTRAINT banknotes_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE daily_puzzles (
  id UUID NOT NULL,
  daily_set_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  answer TEXT NOT NULL,
  accepted_answers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT daily_puzzles_pkey PRIMARY KEY (id),
  CONSTRAINT daily_puzzles_daily_set_id_fkey FOREIGN KEY (daily_set_id) REFERENCES daily_sets(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT daily_puzzles_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT daily_puzzles_answer_check CHECK (length(btrim(answer)) BETWEEN 2 AND 80 AND jsonb_typeof(accepted_answers)='array')
);
CREATE UNIQUE INDEX daily_puzzles_daily_set_id_key ON daily_puzzles(daily_set_id);
CREATE UNIQUE INDEX daily_puzzles_asset_id_key ON daily_puzzles(asset_id);

CREATE TABLE daily_player_states (
  user_id UUID NOT NULL,
  daily_set_id UUID NOT NULL,
  joker_position INTEGER,
  joker_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT daily_player_states_pkey PRIMARY KEY (user_id,daily_set_id),
  CONSTRAINT daily_player_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT daily_player_states_daily_set_id_fkey FOREIGN KEY (daily_set_id) REFERENCES daily_sets(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT daily_player_states_position_check CHECK (joker_position IS NULL OR joker_position BETWEEN 1 AND 8)
);

CREATE TABLE daily_puzzle_guesses (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  daily_set_id UUID NOT NULL,
  season_id UUID NOT NULL,
  guess_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  revealed_count INTEGER NOT NULL,
  reward INTEGER NOT NULL DEFAULT 0,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT daily_puzzle_guesses_pkey PRIMARY KEY (id),
  CONSTRAINT daily_puzzle_guesses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT daily_puzzle_guesses_daily_set_id_fkey FOREIGN KEY (daily_set_id) REFERENCES daily_sets(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT daily_puzzle_guesses_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT daily_puzzle_guesses_content_check CHECK (length(btrim(guess_text)) BETWEEN 1 AND 80 AND revealed_count BETWEEN 0 AND 8 AND reward IN (0,10,20,50,100,200,500,1000,2000,5000) AND ((is_correct AND reward > 0) OR (NOT is_correct AND reward=0)))
);
CREATE UNIQUE INDEX daily_puzzle_guesses_user_id_daily_set_id_key ON daily_puzzle_guesses(user_id,daily_set_id);
CREATE UNIQUE INDEX daily_puzzle_guesses_id_user_id_season_id_key ON daily_puzzle_guesses(id,user_id,season_id);
CREATE INDEX daily_puzzle_guesses_season_id_idx ON daily_puzzle_guesses(season_id);
ALTER TABLE banknotes ADD CONSTRAINT banknotes_puzzle_guess_id_fkey FOREIGN KEY (puzzle_guess_id) REFERENCES daily_puzzle_guesses(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION guard_daily_puzzle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid; st "SetStatus";
BEGIN
  sid := CASE WHEN TG_OP='DELETE' THEN OLD.daily_set_id ELSE NEW.daily_set_id END;
  SELECT status INTO st FROM daily_sets WHERE id=sid;
  IF st IS NULL OR st='CANCELLED' THEN RAISE EXCEPTION 'Puzzle requires an active daily set'; END IF;
  IF st<>'DRAFT' AND (EXISTS(SELECT 1 FROM attempts a JOIN challenges c ON c.id=a.challenge_id WHERE c.daily_set_id=sid) OR EXISTS(SELECT 1 FROM daily_puzzle_guesses g WHERE g.daily_set_id=sid)) THEN
    RAISE EXCEPTION 'Played daily puzzle content is immutable';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER daily_puzzles_content_guard BEFORE INSERT OR UPDATE OR DELETE ON daily_puzzles FOR EACH ROW EXECUTE FUNCTION guard_daily_puzzle();

CREATE OR REPLACE FUNCTION guard_daily_player_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Daily player state cannot be deleted'; END IF;
  IF current_setting('apoen.allow_guest_transfer',true)='on'
     AND NEW.daily_set_id=OLD.daily_set_id AND NEW.joker_position IS NOT DISTINCT FROM OLD.joker_position
     AND NEW.joker_used_at IS NOT DISTINCT FROM OLD.joker_used_at AND NEW.created_at=OLD.created_at
     AND EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id AND is_guest=true)
     AND EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND is_guest=false)
  THEN RETURN NEW; END IF;
  IF OLD.joker_position IS NOT NULL AND NEW.joker_position IS DISTINCT FROM OLD.joker_position THEN RAISE EXCEPTION 'Joker selection is final'; END IF;
  IF OLD.joker_used_at IS NOT NULL AND NEW.joker_used_at IS DISTINCT FROM OLD.joker_used_at THEN RAISE EXCEPTION 'Joker usage is final'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER daily_player_states_guard BEFORE UPDATE OR DELETE ON daily_player_states FOR EACH ROW EXECUTE FUNCTION guard_daily_player_state();

CREATE OR REPLACE FUNCTION reject_puzzle_guess_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND current_setting('apoen.allow_guest_transfer',true)='on'
     AND NEW.daily_set_id=OLD.daily_set_id AND NEW.season_id=OLD.season_id
     AND NEW.guess_text=OLD.guess_text AND NEW.is_correct=OLD.is_correct
     AND NEW.revealed_count=OLD.revealed_count AND NEW.reward=OLD.reward AND NEW.attempted_at=OLD.attempted_at
     AND EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id AND is_guest=true)
     AND EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND is_guest=false)
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Puzzle guesses are append-only';
END $$;
CREATE TRIGGER daily_puzzle_guesses_append_only BEFORE UPDATE OR DELETE ON daily_puzzle_guesses FOR EACH ROW EXECUTE FUNCTION reject_puzzle_guess_mutation();
CREATE TRIGGER daily_player_states_append_only BEFORE DELETE ON daily_player_states FOR EACH ROW EXECUTE FUNCTION reject_puzzle_guess_mutation();

ALTER TABLE banknotes ADD CONSTRAINT banknotes_source_owner_check CHECK (
  (attempt_id IS NOT NULL AND puzzle_guess_id IS NULL) OR
  (attempt_id IS NULL AND puzzle_guess_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION guard_set_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE season_status "SeasonStatus"; challenge_count integer;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status <> 'DRAFT' THEN RAISE EXCEPTION 'Create daily sets as DRAFT and publish through validation'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'Published set cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status='CANCELLED' THEN RAISE EXCEPTION 'Cancelled sets cannot be edited'; END IF;
  IF OLD.status='PUBLISHED' THEN
    IF (to_jsonb(NEW)-'status'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'updated_at') THEN RAISE EXCEPTION 'Published daily set is immutable'; END IF;
    IF NEW.status<>OLD.status AND (NEW.status<>'CANCELLED' OR OLD.play_date <= (clock_timestamp() AT TIME ZONE 'Europe/Belgrade')::date OR EXISTS(SELECT 1 FROM challenges c JOIN attempts a ON a.challenge_id=c.id WHERE c.daily_set_id=OLD.id)) THEN RAISE EXCEPTION 'Only future unused sets may be cancelled'; END IF;
  END IF;
  IF NEW.status='PUBLISHED' AND OLD.status <> 'PUBLISHED' THEN
    SELECT status INTO season_status FROM seasons WHERE id=NEW.season_id;
    SELECT count(*) INTO challenge_count FROM challenges WHERE daily_set_id=NEW.id;
    IF season_status <> 'PUBLISHED' OR challenge_count <> 8 THEN RAISE EXCEPTION 'Set requires published season and exactly eight challenges'; END IF;
    IF EXISTS (SELECT 1 FROM challenges WHERE daily_set_id=NEW.id GROUP BY half HAVING count(DISTINCT mode) <> 4) THEN RAISE EXCEPTION 'Each half requires all four modes'; END IF;
    IF NOT EXISTS (SELECT 1 FROM daily_puzzles WHERE daily_set_id=NEW.id) THEN RAISE EXCEPTION 'Set requires one daily picture puzzle'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validate_banknote_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a attempts%ROWTYPE; g daily_puzzle_guesses%ROWTYPE;
BEGIN
  IF NEW.denomination NOT IN (10,20,50,100,200,500,1000,2000,5000) THEN RAISE EXCEPTION 'Invalid banknote denomination'; END IF;
  IF NEW.attempt_id IS NOT NULL THEN
    SELECT * INTO a FROM attempts WHERE id=NEW.attempt_id;
    IF a.id IS NULL OR a.status='ACTIVE' OR a.final_reward<>NEW.denomination OR a.user_id<>NEW.user_id OR a.season_id<>NEW.season_id OR NEW.issue_no>(CASE WHEN a.joker_used THEN 2 ELSE 1 END) THEN RAISE EXCEPTION 'Banknote does not match completed attempt'; END IF;
  ELSE
    SELECT * INTO g FROM daily_puzzle_guesses WHERE id=NEW.puzzle_guess_id;
    IF g.id IS NULL OR NOT g.is_correct OR g.reward<>NEW.denomination OR g.user_id<>NEW.user_id OR g.season_id<>NEW.season_id OR NEW.issue_no<>1 THEN RAISE EXCEPTION 'Banknote does not match correct picture guess'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER banknotes_validate_insert BEFORE INSERT ON banknotes FOR EACH ROW EXECUTE FUNCTION validate_banknote_insert();
