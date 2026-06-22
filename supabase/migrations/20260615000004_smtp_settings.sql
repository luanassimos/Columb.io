-- Create smtp_settings table linked to workspaces
CREATE TABLE IF NOT EXISTS smtp_settings (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  secure BOOLEAN NOT NULL DEFAULT false,
  user_email TEXT NOT NULL,
  password TEXT NOT NULL,
  from_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE smtp_settings ENABLE ROW LEVEL SECURITY;

-- Workspace policy matching
DROP POLICY IF EXISTS "Smtp settings match workspace" ON smtp_settings;
CREATE POLICY "Smtp settings match workspace" ON smtp_settings 
  FOR ALL TO authenticated USING (workspace_id = get_user_workspace_id()) WITH CHECK (workspace_id = get_user_workspace_id());
