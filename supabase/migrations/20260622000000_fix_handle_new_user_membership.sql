-- Ensure new Supabase Auth users receive a workspace, profile, and workspace membership.
-- This preserves the timezone support introduced in 20260616000002_workspace_timezone.sql.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_workspace_id UUID;
  workspace_name TEXT;
  timezone_val TEXT;
BEGIN
  workspace_name := COALESCE(new.raw_user_meta_data->>'workspace_name', 'My Workspace');
  timezone_val := COALESCE(new.raw_user_meta_data->>'timezone', 'America/Sao_Paulo');

  INSERT INTO public.workspaces (name, timezone)
  VALUES (workspace_name, timezone_val)
  RETURNING id INTO default_workspace_id;

  INSERT INTO public.profiles (id, name, workspace_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', 'User'),
    default_workspace_id
  );

  INSERT INTO public.workspace_members (workspace_id, user_id)
  VALUES (default_workspace_id, new.id)
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
