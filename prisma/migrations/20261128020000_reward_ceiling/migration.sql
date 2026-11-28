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
    IF EXISTS(SELECT 1 FROM collectible_tiers WHERE season_id=NEW.id AND threshold_amount > 50000 * month_days) THEN RAISE EXCEPTION 'Tier exceeds season maximum'; END IF;
  END IF;
  RETURN NEW;
END $$;
