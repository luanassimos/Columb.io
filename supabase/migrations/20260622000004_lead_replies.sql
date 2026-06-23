-- Create lead replies table
CREATE TABLE IF NOT EXISTS public.lead_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.lead_replies ENABLE ROW LEVEL SECURITY;

-- Create policy based on workspace membership
CREATE POLICY "Lead replies workspace member" ON public.lead_replies
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_replies_workspace ON public.lead_replies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lead_replies_contact ON public.lead_replies(contact_id);

NOTIFY pgrst, 'reload schema';
