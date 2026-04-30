-- Add chain-related columns to action_runs
ALTER TABLE "action_runs"
  ADD COLUMN IF NOT EXISTS "chain_id" uuid,
  ADD COLUMN IF NOT EXISTS "step_index" integer;

-- Add actions array column to triggers (nullable; when present, replaces action_type/action_config)
ALTER TABLE "triggers"
  ADD COLUMN IF NOT EXISTS "actions" jsonb;
