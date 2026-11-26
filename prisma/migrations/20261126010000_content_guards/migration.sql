CREATE OR REPLACE FUNCTION guard_season_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('PUBLISHED','CLOSED') AND (to_jsonb(NEW) - 'status' - 'closed_at' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'closed_at' - 'updated_at') THEN
    RAISE EXCEPTION 'Published season content is immutable';
  END IF;
  IF OLD.status IN ('PUBLISHED','CLOSED') AND NEW.status NOT IN (OLD.status,'CLOSED') THEN
    RAISE EXCEPTION 'Invalid season status transition';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'Published season cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seasons_content_guard BEFORE UPDATE OR DELETE ON seasons FOR EACH ROW EXECUTE FUNCTION guard_season_content();

CREATE OR REPLACE FUNCTION guard_tier_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s_status "SeasonStatus";
BEGIN
  SELECT status INTO s_status FROM seasons WHERE id=OLD.season_id;
  IF s_status IN ('PUBLISHED','CLOSED') THEN RAISE EXCEPTION 'Published collectible tiers are immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tiers_content_guard BEFORE UPDATE OR DELETE ON collectible_tiers FOR EACH ROW EXECUTE FUNCTION guard_tier_content();

CREATE OR REPLACE FUNCTION guard_set_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE season_status "SeasonStatus"; challenge_count integer;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'Published set cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status='PUBLISHED' AND (to_jsonb(NEW)-'status'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'updated_at') THEN RAISE EXCEPTION 'Published daily set is immutable'; END IF;
  IF NEW.status='PUBLISHED' AND OLD.status <> 'PUBLISHED' THEN
    SELECT status INTO season_status FROM seasons WHERE id=NEW.season_id;
    SELECT count(*) INTO challenge_count FROM challenges WHERE daily_set_id=NEW.id;
    IF season_status <> 'PUBLISHED' OR challenge_count <> 8 THEN RAISE EXCEPTION 'Set requires published season and exactly eight challenges'; END IF;
    IF EXISTS (SELECT 1 FROM challenges WHERE daily_set_id=NEW.id GROUP BY half HAVING count(DISTINCT mode) <> 4) THEN RAISE EXCEPTION 'Each half requires all four modes'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER daily_sets_content_guard BEFORE UPDATE OR DELETE ON daily_sets FOR EACH ROW EXECUTE FUNCTION guard_set_content();

CREATE OR REPLACE FUNCTION guard_challenge_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE set_status "SetStatus"; set_id uuid;
BEGIN
  set_id := CASE WHEN TG_OP='DELETE' THEN OLD.daily_set_id ELSE NEW.daily_set_id END;
  SELECT status INTO set_status FROM daily_sets WHERE id=set_id;
  IF set_status <> 'DRAFT' THEN RAISE EXCEPTION 'Published challenge content is immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER challenges_content_guard BEFORE UPDATE OR DELETE ON challenges FOR EACH ROW EXECUTE FUNCTION guard_challenge_content();
CREATE OR REPLACE FUNCTION guard_option_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE set_status "SetStatus";
BEGIN
  SELECT ds.status INTO set_status FROM challenges c JOIN daily_sets ds ON ds.id=c.daily_set_id WHERE c.id=CASE WHEN TG_OP='DELETE' THEN OLD.challenge_id ELSE NEW.challenge_id END;
  IF set_status <> 'DRAFT' THEN RAISE EXCEPTION 'Published options are immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER options_content_guard BEFORE UPDATE OR DELETE ON challenge_options FOR EACH ROW EXECUTE FUNCTION guard_option_content();
CREATE OR REPLACE FUNCTION guard_asset_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Media assets are immutable'; END $$;
CREATE TRIGGER assets_immutable_guard BEFORE UPDATE OR DELETE ON media_assets FOR EACH ROW EXECUTE FUNCTION guard_asset_immutable();
