CREATE OR REPLACE FUNCTION guard_season_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tier_count integer; first_threshold integer; month_days integer;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status <> 'DRAFT' THEN RAISE EXCEPTION 'Create seasons as DRAFT and publish through validation'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'Published season cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('PUBLISHED','CLOSED') AND (to_jsonb(NEW)-'status'-'closed_at'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'closed_at'-'updated_at') THEN RAISE EXCEPTION 'Published season content is immutable'; END IF;
  IF OLD.status IN ('PUBLISHED','CLOSED') AND NEW.status NOT IN (OLD.status,'CLOSED') THEN RAISE EXCEPTION 'Invalid season status transition'; END IF;
  IF OLD.status='DRAFT' AND NEW.status='PUBLISHED' THEN
    SELECT count(*),min(threshold_amount) INTO tier_count,first_threshold FROM collectible_tiers WHERE season_id=NEW.id;
    IF tier_count<1 OR first_threshold<>0 THEN RAISE EXCEPTION 'Published season requires a tier at threshold zero'; END IF;
    month_days := ((NEW.ends_at AT TIME ZONE 'Europe/Belgrade')::date - (NEW.starts_at AT TIME ZONE 'Europe/Belgrade')::date);
    IF EXISTS(SELECT 1 FROM collectible_tiers WHERE season_id=NEW.id AND threshold_amount > 40000 * month_days) THEN RAISE EXCEPTION 'Tier exceeds season maximum'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER seasons_content_guard ON seasons;
CREATE TRIGGER seasons_content_guard BEFORE INSERT OR UPDATE OR DELETE ON seasons FOR EACH ROW EXECUTE FUNCTION guard_season_content();

CREATE OR REPLACE FUNCTION guard_tier_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s_status "SeasonStatus"; sid uuid;
BEGIN
  sid:=CASE WHEN TG_OP='DELETE' THEN OLD.season_id ELSE NEW.season_id END;
  SELECT status INTO s_status FROM seasons WHERE id=sid;
  IF s_status IN ('PUBLISHED','CLOSED') THEN RAISE EXCEPTION 'Published collectible tiers are immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER tiers_content_guard ON collectible_tiers;
CREATE TRIGGER tiers_content_guard BEFORE INSERT OR UPDATE OR DELETE ON collectible_tiers FOR EACH ROW EXECUTE FUNCTION guard_tier_content();

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
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER daily_sets_content_guard ON daily_sets;
CREATE TRIGGER daily_sets_content_guard BEFORE INSERT OR UPDATE OR DELETE ON daily_sets FOR EACH ROW EXECUTE FUNCTION guard_set_content();

CREATE OR REPLACE FUNCTION guard_challenge_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE set_status "SetStatus"; set_id uuid;
BEGIN
  set_id:=CASE WHEN TG_OP='DELETE' THEN OLD.daily_set_id ELSE NEW.daily_set_id END;
  SELECT status INTO set_status FROM daily_sets WHERE id=set_id;
  IF set_status <> 'DRAFT' THEN RAISE EXCEPTION 'Published challenge content is immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER challenges_content_guard ON challenges;
CREATE TRIGGER challenges_content_guard BEFORE INSERT OR UPDATE OR DELETE ON challenges FOR EACH ROW EXECUTE FUNCTION guard_challenge_content();
CREATE OR REPLACE FUNCTION guard_option_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE set_status "SetStatus"; challenge_id uuid;
BEGIN
  challenge_id:=CASE WHEN TG_OP='DELETE' THEN OLD.challenge_id ELSE NEW.challenge_id END;
  SELECT ds.status INTO set_status FROM challenges c JOIN daily_sets ds ON ds.id=c.daily_set_id WHERE c.id=challenge_id;
  IF set_status <> 'DRAFT' THEN RAISE EXCEPTION 'Published options are immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER options_content_guard ON challenge_options;
CREATE TRIGGER options_content_guard BEFORE INSERT OR UPDATE OR DELETE ON challenge_options FOR EACH ROW EXECUTE FUNCTION guard_option_content();
