-- Migration: Add timezone column to workspaces table and update sign-up trigger
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- Recreate trigger function to accept timezone from user metadata during sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_workspace_id UUID;
  workspace_name TEXT;
  timezone_val TEXT;
BEGIN
  -- Read workspace name from metadata or default to 'My Workspace'
  workspace_name := COALESCE(new.raw_user_meta_data->>'workspace_name', 'My Workspace');
  
  -- Read timezone from metadata or default to 'America/Sao_Paulo'
  timezone_val := COALESCE(new.raw_user_meta_data->>'timezone', 'America/Sao_Paulo');

  -- 1. Insert a default workspace
  INSERT INTO public.workspaces (name, timezone)
  VALUES (workspace_name, timezone_val)
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

-- Re-notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
