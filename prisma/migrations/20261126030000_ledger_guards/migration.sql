CREATE OR REPLACE FUNCTION reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Ledger and audit records are append-only'; END $$;
CREATE TRIGGER banknotes_append_only BEFORE UPDATE OR DELETE ON banknotes FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER attempt_actions_append_only BEFORE UPDATE OR DELETE ON attempt_actions FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER admin_audit_append_only BEFORE UPDATE OR DELETE ON admin_audit FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER collectibles_append_only BEFORE UPDATE OR DELETE ON user_collectibles FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE OR REPLACE FUNCTION guard_terminal_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Terminal attempts cannot be changed'; END IF;
  IF NEW.status='ACTIVE' AND (NEW.final_reward IS NOT NULL OR NEW.finished_at IS NOT NULL OR NEW.end_reason IS NOT NULL) THEN RAISE EXCEPTION 'Active attempts cannot have a result'; END IF;
  IF NEW.status<>'ACTIVE' AND (NEW.final_reward IS NULL OR NEW.finished_at IS NULL OR NEW.end_reason IS NULL) THEN RAISE EXCEPTION 'Terminal attempts require a final result'; END IF;
  IF NEW.final_reward NOT IN (0,10,20,50,100,200,500,1000,2000,5000) THEN RAISE EXCEPTION 'Invalid attempt reward'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attempts_terminal_guard BEFORE UPDATE ON attempts FOR EACH ROW EXECUTE FUNCTION guard_terminal_attempt();
