-- Add workspace roles and protect every workspace from losing its last owner.

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

ALTER TABLE public.workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_role_check;

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer'));

WITH ranked_members AS (
  SELECT
    workspace_id,
    user_id,
    row_number() OVER (
      PARTITION BY workspace_id
      ORDER BY created_at ASC, user_id ASC
    ) AS member_rank
  FROM public.workspace_members
),
owner_candidates AS (
  SELECT workspace_id, user_id
  FROM ranked_members
  WHERE member_rank = 1
)
UPDATE public.workspace_members wm
SET role = 'owner'
FROM owner_candidates oc
WHERE wm.workspace_id = oc.workspace_id
  AND wm.user_id = oc.user_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.workspace_members existing_owner
    WHERE existing_owner.workspace_id = wm.workspace_id
      AND existing_owner.role = 'owner'
  );

CREATE OR REPLACE FUNCTION public.current_user_workspace_role(target_workspace_id UUID)
RETURNS TEXT AS $$
  SELECT wm.role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = target_workspace_id
    AND wm.user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(target_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(public.current_user_workspace_role(target_workspace_id) IN ('owner', 'admin'), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_user_has_workspace_role(
  target_workspace_id UUID,
  allowed_roles TEXT[]
)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(public.current_user_workspace_role(target_workspace_id) = ANY(allowed_roles), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.prevent_last_workspace_owner_change()
RETURNS trigger AS $$
DECLARE
  remaining_owner_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
    SELECT count(*)
    INTO remaining_owner_count
    FROM public.workspace_members
    WHERE workspace_id = OLD.workspace_id
      AND role = 'owner'
      AND user_id <> OLD.user_id;

    IF remaining_owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last owner from a workspace';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner' THEN
    SELECT count(*)
    INTO remaining_owner_count
    FROM public.workspace_members
    WHERE workspace_id = OLD.workspace_id
      AND role = 'owner'
      AND user_id <> OLD.user_id;

    IF remaining_owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot downgrade the last owner from a workspace';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_last_workspace_owner_change ON public.workspace_members;
CREATE TRIGGER prevent_last_workspace_owner_change
  BEFORE UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_workspace_owner_change();

-- Members may still read/delete only their own rows. Admin/owner member
-- management is intentionally scoped for future UI work, but RLS allows it now.
DROP POLICY IF EXISTS "Members select own" ON public.workspace_members;
DROP POLICY IF EXISTS "Members select own or workspace admin" ON public.workspace_members;
CREATE POLICY "Members select own or workspace admin" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_workspace_admin(workspace_id)
  );

DROP POLICY IF EXISTS "Members insert own" ON public.workspace_members;
DROP POLICY IF EXISTS "Members insert own first membership or workspace admin" ON public.workspace_members;
CREATE POLICY "Members insert own first membership or workspace admin" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      user_id = auth.uid()
      AND role = 'owner'
      AND NOT public.workspace_has_members(workspace_id)
    )
    OR (
      public.is_workspace_admin(workspace_id)
      AND role <> 'owner'
    )
  );

DROP POLICY IF EXISTS "Members delete own" ON public.workspace_members;
DROP POLICY IF EXISTS "Members delete own or workspace admin" ON public.workspace_members;
CREATE POLICY "Members delete own or workspace admin" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      public.is_workspace_admin(workspace_id)
      AND role <> 'owner'
    )
  );

DROP POLICY IF EXISTS "Members update workspace admin" ON public.workspace_members;
CREATE POLICY "Members update workspace admin" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (
    public.is_workspace_admin(workspace_id)
    AND role <> 'owner'
  )
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND role <> 'owner'
  );

-- Role-aware RLS for workspace-scoped data. Reads remain membership-based;
-- writes are restricted to the role levels used by the application actions.
DROP POLICY IF EXISTS "Workspaces update matching" ON public.workspaces;
DROP POLICY IF EXISTS "Workspaces update member" ON public.workspaces;
DROP POLICY IF EXISTS "Workspaces update admin" ON public.workspaces;
CREATE POLICY "Workspaces update admin" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.current_user_has_workspace_role(id, ARRAY['owner', 'admin']))
  WITH CHECK (public.current_user_has_workspace_role(id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Workspaces delete owner" ON public.workspaces;
CREATE POLICY "Workspaces delete owner" ON public.workspaces
  FOR DELETE TO authenticated
  USING (public.current_user_has_workspace_role(id, ARRAY['owner']));

DROP POLICY IF EXISTS "Contacts match workspace" ON public.contacts;
DROP POLICY IF EXISTS "Contacts workspace member" ON public.contacts;
DROP POLICY IF EXISTS "Contacts select workspace member" ON public.contacts;
DROP POLICY IF EXISTS "Contacts insert editor" ON public.contacts;
DROP POLICY IF EXISTS "Contacts update editor" ON public.contacts;
DROP POLICY IF EXISTS "Contacts delete manager" ON public.contacts;
CREATE POLICY "Contacts select workspace member" ON public.contacts
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Contacts insert editor" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));
CREATE POLICY "Contacts update editor" ON public.contacts
  FOR UPDATE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));
CREATE POLICY "Contacts delete manager" ON public.contacts
  FOR DELETE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager']));

DROP POLICY IF EXISTS "Templates match workspace" ON public.templates;
DROP POLICY IF EXISTS "Templates workspace member" ON public.templates;
DROP POLICY IF EXISTS "Templates select workspace member" ON public.templates;
DROP POLICY IF EXISTS "Templates insert editor" ON public.templates;
DROP POLICY IF EXISTS "Templates update editor" ON public.templates;
DROP POLICY IF EXISTS "Templates delete manager" ON public.templates;
CREATE POLICY "Templates select workspace member" ON public.templates
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Templates insert editor" ON public.templates
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));
CREATE POLICY "Templates update editor" ON public.templates
  FOR UPDATE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));
CREATE POLICY "Templates delete manager" ON public.templates
  FOR DELETE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager']));

DROP POLICY IF EXISTS "Campaigns match workspace" ON public.campaigns;
DROP POLICY IF EXISTS "Campaigns workspace member" ON public.campaigns;
DROP POLICY IF EXISTS "Campaigns select workspace member" ON public.campaigns;
DROP POLICY IF EXISTS "Campaigns insert editor" ON public.campaigns;
DROP POLICY IF EXISTS "Campaigns update editor" ON public.campaigns;
DROP POLICY IF EXISTS "Campaigns delete manager" ON public.campaigns;
CREATE POLICY "Campaigns select workspace member" ON public.campaigns
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Campaigns insert editor" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager'])
    OR (
      public.current_user_has_workspace_role(workspace_id, ARRAY['member'])
      AND status = 'draft'
    )
  );
CREATE POLICY "Campaigns update editor" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager'])
    OR (
      public.current_user_has_workspace_role(workspace_id, ARRAY['member'])
      AND status = 'draft'
    )
  )
  WITH CHECK (
    public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager'])
    OR (
      public.current_user_has_workspace_role(workspace_id, ARRAY['member'])
      AND status = 'draft'
    )
  );
CREATE POLICY "Campaigns delete manager" ON public.campaigns
  FOR DELETE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager']));

DROP POLICY IF EXISTS "Email jobs match workspace" ON public.email_jobs;
DROP POLICY IF EXISTS "Email jobs workspace member" ON public.email_jobs;
DROP POLICY IF EXISTS "Email jobs select workspace member" ON public.email_jobs;
DROP POLICY IF EXISTS "Email jobs insert sender" ON public.email_jobs;
DROP POLICY IF EXISTS "Email jobs update sender" ON public.email_jobs;
DROP POLICY IF EXISTS "Email jobs delete sender" ON public.email_jobs;
CREATE POLICY "Email jobs select workspace member" ON public.email_jobs
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Email jobs insert sender" ON public.email_jobs
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager']));
CREATE POLICY "Email jobs update sender" ON public.email_jobs
  FOR UPDATE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager']));
CREATE POLICY "Email jobs delete sender" ON public.email_jobs
  FOR DELETE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager']));

DROP POLICY IF EXISTS "Smtp settings match workspace" ON public.smtp_settings;
DROP POLICY IF EXISTS "Smtp settings workspace member" ON public.smtp_settings;
DROP POLICY IF EXISTS "Smtp settings admin" ON public.smtp_settings;
CREATE POLICY "Smtp settings admin" ON public.smtp_settings
  FOR ALL TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

CREATE OR REPLACE FUNCTION public.get_smtp_sender_options(target_workspace_id UUID)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  host TEXT,
  port INTEGER,
  secure BOOLEAN,
  user_email TEXT,
  from_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
  SELECT
    s.id,
    s.workspace_id,
    s.host,
    s.port,
    s.secure,
    s.user_email,
    s.from_name,
    s.created_at
  FROM public.smtp_settings s
  WHERE s.workspace_id = target_workspace_id
    AND public.current_user_has_workspace_role(
      target_workspace_id,
      ARRAY['owner', 'admin', 'manager', 'member']
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS "Notifications match workspace" ON public.notifications;
DROP POLICY IF EXISTS "Notifications workspace member" ON public.notifications;
DROP POLICY IF EXISTS "Notifications select workspace member" ON public.notifications;
DROP POLICY IF EXISTS "Notifications mutate admin" ON public.notifications;
CREATE POLICY "Notifications select workspace member" ON public.notifications
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Notifications mutate admin" ON public.notifications
  FOR ALL TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

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

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (default_workspace_id, new.id, 'owner');

  INSERT INTO public.profiles (id, name, workspace_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', 'User'),
    default_workspace_id
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
