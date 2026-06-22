-- Harden workspace isolation by making RLS membership-based instead of trusting
-- only profiles.workspace_id. No role model exists yet, so membership is the
-- authorization boundary.

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_workspace_id()
RETURNS UUID AS $$
  SELECT p.workspace_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND public.is_workspace_member(p.workspace_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.workspace_has_members(target_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Profiles: users can only point their active profile at a workspace where
-- they already have membership.
DROP POLICY IF EXISTS "Profiles self insert" ON profiles;
CREATE POLICY "Profiles self insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND public.is_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "Profiles self update" ON profiles;
CREATE POLICY "Profiles self update" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND public.is_workspace_member(workspace_id)
  );

-- Membership: users may read/delete their own memberships, but can only create
-- their own membership for a workspace that has no members yet. This preserves
-- current self-service workspace creation without allowing users to join an
-- existing workspace by guessing its UUID.
DROP POLICY IF EXISTS "Members insert own" ON workspace_members;
CREATE POLICY "Members insert own" ON workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.workspace_has_members(workspace_id)
  );

-- Workspaces: workspace access follows membership. Insert remains allowed so a
-- user can create a workspace, then create the first membership row above.
DROP POLICY IF EXISTS "Workspaces update matching" ON workspaces;
CREATE POLICY "Workspaces update member" ON workspaces
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(id))
  WITH CHECK (public.is_workspace_member(id));

-- Business data: every workspace-scoped table is isolated by membership.
DROP POLICY IF EXISTS "Contacts match workspace" ON contacts;
CREATE POLICY "Contacts workspace member" ON contacts
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Templates match workspace" ON templates;
CREATE POLICY "Templates workspace member" ON templates
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Campaigns match workspace" ON campaigns;
CREATE POLICY "Campaigns workspace member" ON campaigns
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Email jobs match workspace" ON email_jobs;
CREATE POLICY "Email jobs workspace member" ON email_jobs
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Notifications match workspace" ON notifications;
CREATE POLICY "Notifications workspace member" ON notifications
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Smtp settings match workspace" ON smtp_settings;
CREATE POLICY "Smtp settings workspace member" ON smtp_settings
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

NOTIFY pgrst, 'reload schema';
