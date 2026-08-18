DROP POLICY IF EXISTS "Automation settings manage" ON public.automation_settings;
CREATE POLICY "Automation settings insert" ON public.automation_settings FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner','admin','manager']));
CREATE POLICY "Automation settings update" ON public.automation_settings FOR UPDATE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner','admin','manager']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner','admin','manager']));
CREATE POLICY "Automation settings delete" ON public.automation_settings FOR DELETE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner','admin','manager']));

DROP POLICY IF EXISTS "Prospecting emails manage" ON public.prospecting_emails;
CREATE POLICY "Prospecting emails insert" ON public.prospecting_emails FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner','admin','manager','member']));
CREATE POLICY "Prospecting emails update" ON public.prospecting_emails FOR UPDATE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner','admin','manager','member']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner','admin','manager','member']));
CREATE POLICY "Prospecting emails delete" ON public.prospecting_emails FOR DELETE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner','admin','manager','member']));
