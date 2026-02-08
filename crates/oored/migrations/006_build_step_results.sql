-- Add step results and exit code to builds table for Bug #4 fix
-- (step/exit metadata was accepted but not persisted)
ALTER TABLE builds ADD COLUMN step_results TEXT;
ALTER TABLE builds ADD COLUMN exit_code INTEGER;
