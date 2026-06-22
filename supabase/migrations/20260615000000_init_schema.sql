-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'waiting', 'replied', 'converted', 'closed')),
  last_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES templates(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'running', 'completed', 'cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create email_jobs table
CREATE TABLE IF NOT EXISTS email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'opened', 'replied')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  step_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email_replied', 'campaign_finished', 'followup_pending', 'delivery_failed')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies (user can only access own profile)
DROP POLICY IF EXISTS "Profiles self select" ON profiles;
CREATE POLICY "Profiles self select" ON profiles 
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles self insert" ON profiles;
CREATE POLICY "Profiles self insert" ON profiles 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles self update" ON profiles;
CREATE POLICY "Profiles self update" ON profiles 
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Helper function to fetch active workspace
CREATE OR REPLACE FUNCTION get_user_workspace_id()
RETURNS UUID AS $$
  SELECT workspace_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Workspaces Policies (user only accesses matching workspace_id)
DROP POLICY IF EXISTS "Workspaces select matching" ON workspaces;
CREATE POLICY "Workspaces select matching" ON workspaces 
  FOR SELECT TO authenticated USING (id = get_user_workspace_id());

DROP POLICY IF EXISTS "Workspaces insert allowed" ON workspaces;
CREATE POLICY "Workspaces insert allowed" ON workspaces 
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Workspaces update matching" ON workspaces;
CREATE POLICY "Workspaces update matching" ON workspaces 
  FOR UPDATE TO authenticated USING (id = get_user_workspace_id()) WITH CHECK (id = get_user_workspace_id());

-- 3. Business tables Policies (user only accesses matching workspace_id)
DROP POLICY IF EXISTS "Contacts match workspace" ON contacts;
CREATE POLICY "Contacts match workspace" ON contacts 
  FOR ALL TO authenticated USING (workspace_id = get_user_workspace_id()) WITH CHECK (workspace_id = get_user_workspace_id());

DROP POLICY IF EXISTS "Templates match workspace" ON templates;
CREATE POLICY "Templates match workspace" ON templates 
  FOR ALL TO authenticated USING (workspace_id = get_user_workspace_id()) WITH CHECK (workspace_id = get_user_workspace_id());

DROP POLICY IF EXISTS "Campaigns match workspace" ON campaigns;
CREATE POLICY "Campaigns match workspace" ON campaigns 
  FOR ALL TO authenticated USING (workspace_id = get_user_workspace_id()) WITH CHECK (workspace_id = get_user_workspace_id());

DROP POLICY IF EXISTS "Email jobs match workspace" ON email_jobs;
CREATE POLICY "Email jobs match workspace" ON email_jobs 
  FOR ALL TO authenticated USING (workspace_id = get_user_workspace_id()) WITH CHECK (workspace_id = get_user_workspace_id());

DROP POLICY IF EXISTS "Notifications match workspace" ON notifications;
CREATE POLICY "Notifications match workspace" ON notifications 
  FOR ALL TO authenticated USING (workspace_id = get_user_workspace_id()) WITH CHECK (workspace_id = get_user_workspace_id());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_templates_workspace ON templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_jobs_workspace ON email_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);

-- Trigger function to automatically create a workspace and profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_workspace_id UUID;
  workspace_name TEXT;
BEGIN
  -- Read workspace name from metadata or default to 'My Workspace'
  workspace_name := COALESCE(new.raw_user_meta_data->>'workspace_name', 'My Workspace');

  -- 1. Insert a default workspace
  INSERT INTO public.workspaces (name)
  VALUES (workspace_name)
  RETURNING id INTO default_workspace_id;

  -- 2. Insert the user profile linked to the new workspace
  INSERT INTO public.profiles (id, name, workspace_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', 'User'),
    default_workspace_id
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute after signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
