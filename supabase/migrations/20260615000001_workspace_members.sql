-- Migration: Add workspace_members table and fix RLS so users can see all their workspaces
-- Run this in your Supabase SQL editor

-- 1. Create workspace_members join table
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- 2. Enable RLS on workspace_members
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- 3. workspace_members policies: users can only see/manage their own rows
DROP POLICY IF EXISTS "Members select own" ON workspace_members;
CREATE POLICY "Members select own" ON workspace_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members insert own" ON workspace_members;
CREATE POLICY "Members insert own" ON workspace_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members delete own" ON workspace_members;
CREATE POLICY "Members delete own" ON workspace_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4. Fix workspaces SELECT policy: allow user to see any workspace they are a member of
DROP POLICY IF EXISTS "Workspaces select matching" ON workspaces;
CREATE POLICY "Workspaces select member" ON workspaces
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- 5. Backfill existing workspace memberships from profiles
INSERT INTO workspace_members (workspace_id, user_id)
SELECT workspace_id, id FROM profiles
ON CONFLICT DO NOTHING;

-- 6. Update handle_new_user trigger to also insert into workspace_members
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_workspace_id UUID;
  workspace_name TEXT;
BEGIN
  workspace_name := COALESCE(new.raw_user_meta_data->>'workspace_name', 'My Workspace');

  INSERT INTO public.workspaces (name)
  VALUES (workspace_name)
  RETURNING id INTO default_workspace_id;

  INSERT INTO public.profiles (id, name, workspace_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', 'User'),
    default_workspace_id
  );

  -- Register membership
  INSERT INTO public.workspace_members (workspace_id, user_id)
  VALUES (default_workspace_id, new.id);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
