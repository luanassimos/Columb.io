-- Migration: Recreate smtp_settings table to support multiple configurations per workspace, and link campaigns
DROP TABLE IF EXISTS smtp_settings CASCADE;

CREATE TABLE IF NOT EXISTS smtp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  secure BOOLEAN NOT NULL DEFAULT false,
  user_email TEXT NOT NULL,
  password TEXT NOT NULL,
  from_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_email)
);

ALTER TABLE smtp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Smtp settings match workspace" ON smtp_settings;
CREATE POLICY "Smtp settings match workspace" ON smtp_settings 
  FOR ALL TO authenticated USING (workspace_id = get_user_workspace_id()) WITH CHECK (workspace_id = get_user_workspace_id());

-- Add smtp_setting_id column to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS smtp_setting_id UUID REFERENCES smtp_settings(id) ON DELETE SET NULL;
