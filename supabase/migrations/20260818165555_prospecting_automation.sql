-- Structural prospecting refactor. Existing campaigns, templates, contacts and
-- email jobs are preserved; this migration only extends them and adds the
-- workspace automation ledger.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS company_profile_raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS company_ai_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS company_profile_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS domain_normalized TEXT,
  ADD COLUMN IF NOT EXISTS email_normalized TEXT,
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS yelp_id TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS operational_status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS email_valid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_send_eligible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bounced BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disqualified_reason TEXT,
  ADD COLUMN IF NOT EXISTS contact_source TEXT,
  ADD COLUMN IF NOT EXISTS contact_source_url TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_source TEXT,
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_fit_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_fit_label TEXT,
  ADD COLUMN IF NOT EXISTS ai_fit_reason TEXT,
  ADD COLUMN IF NOT EXISTS ai_opportunity_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_recommended_service TEXT,
  ADD COLUMN IF NOT EXISTS ai_personalization_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_suggested_approach TEXT,
  ADD COLUMN IF NOT EXISTS ai_input_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_ai_analyzed_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.contacts ADD CONSTRAINT contacts_operational_status_check
    CHECK (operational_status IN ('new','enriching','ready','queued','contacted','replied','disqualified'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.contacts ADD CONSTRAINT contacts_ai_fit_score_check
    CHECK (ai_fit_score IS NULL OR ai_fit_score BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_source_lead
  ON public.contacts(workspace_id, source_lead_id) WHERE source_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_automation_queue
  ON public.contacts(workspace_id, operational_status, ai_fit_score, created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_normalized_domain ON public.contacts(workspace_id, domain_normalized);
CREATE INDEX IF NOT EXISTS idx_contacts_normalized_email ON public.contacts(workspace_id, email_normalized);
CREATE INDEX IF NOT EXISTS idx_contacts_normalized_phone ON public.contacts(workspace_id, phone_normalized);

CREATE TABLE IF NOT EXISTS public.contact_dedupe_keys (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS public.suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  suppression_type TEXT NOT NULL CHECK (suppression_type IN ('domain','email','phone','company')),
  normalized_value TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('contacted','do_not_contact','unsubscribed','bounced','invalid','manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, suppression_type, normalized_value)
);

CREATE TABLE IF NOT EXISTS public.automation_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  auto_send_enabled BOOLEAN NOT NULL DEFAULT false,
  daily_search_enabled BOOLEAN NOT NULL DEFAULT true,
  enrichment_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_lead_limit INTEGER NOT NULL DEFAULT 20 CHECK (daily_lead_limit BETWEEN 1 AND 500),
  daily_email_limit INTEGER NOT NULL DEFAULT 20 CHECK (daily_email_limit BETWEEN 0 AND 500),
  minimum_fit_score INTEGER NOT NULL DEFAULT 65 CHECK (minimum_fit_score BETWEEN 0 AND 100),
  target_industries TEXT[] NOT NULL DEFAULT '{}',
  target_regions TEXT[] NOT NULL DEFAULT '{}',
  run_time TIME NOT NULL DEFAULT '10:00',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  weekdays SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  sender_name TEXT,
  sender_email TEXT,
  reply_to TEXT,
  signature TEXT,
  email_configuration_tested_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','partial','failed')),
  leads_requested INTEGER NOT NULL DEFAULT 0,
  leads_found INTEGER NOT NULL DEFAULT 0,
  leads_created INTEGER NOT NULL DEFAULT 0,
  leads_enriched INTEGER NOT NULL DEFAULT 0,
  leads_qualified INTEGER NOT NULL DEFAULT 0,
  emails_generated INTEGER NOT NULL DEFAULT 0,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  leads_skipped INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.automation_run_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','error')),
  stage TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospecting_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  automation_run_id UUID REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  personalization_reason TEXT,
  status TEXT NOT NULL DEFAULT 'ready_for_review' CHECK (status IN ('ready_for_review','queued','sending','sent','failed','cancelled')),
  provider TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);

ALTER TABLE public.lead_finder_jobs
  ADD COLUMN IF NOT EXISTS automation_run_id UUID REFERENCES public.automation_runs(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_finder_automation_run
  ON public.lead_finder_jobs(automation_run_id) WHERE automation_run_id IS NOT NULL;

ALTER TABLE public.contact_dedupe_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_run_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dedupe keys workspace member" ON public.contact_dedupe_keys FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Suppression workspace member" ON public.suppression_list FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Automation settings select" ON public.automation_settings FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Automation settings manage" ON public.automation_settings FOR ALL TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner','admin','manager']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner','admin','manager']));
CREATE POLICY "Automation runs select" ON public.automation_runs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Automation logs select" ON public.automation_run_logs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Prospecting emails select" ON public.prospecting_emails FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Prospecting emails manage" ON public.prospecting_emails FOR ALL TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner','admin','manager','member']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner','admin','manager','member']));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_dedupe_keys, public.suppression_list,
  public.automation_settings, public.prospecting_emails TO authenticated;
GRANT SELECT ON public.automation_runs, public.automation_run_logs TO authenticated;

CREATE INDEX IF NOT EXISTS idx_automation_runs_workspace_date ON public.automation_runs(workspace_id, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_run ON public.automation_run_logs(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_prospecting_emails_contact ON public.prospecting_emails(workspace_id, contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suppression_lookup ON public.suppression_list(workspace_id, suppression_type, normalized_value);

-- Backfill normalized identities without modifying or deleting legacy records.
UPDATE public.contacts SET
  email_normalized = NULLIF(lower(btrim(email)), ''),
  email_valid = NULLIF(lower(btrim(email)), '') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$',
  phone_normalized = NULLIF(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), ''),
  domain_normalized = CASE WHEN NULLIF(btrim(website), '') IS NULL THEN NULL ELSE
    NULLIF(lower(split_part(regexp_replace(btrim(website), '^https?://(www\.)?', '', 'i'), '/', 1)), '') END
WHERE email_normalized IS NULL OR phone_normalized IS NULL OR domain_normalized IS NULL;

INSERT INTO public.contact_dedupe_keys(workspace_id, dedupe_key, contact_id)
SELECT DISTINCT ON (workspace_id, dedupe_key) workspace_id, dedupe_key, contact_id
FROM (
  SELECT workspace_id, 'email:' || email_normalized AS dedupe_key, id AS contact_id FROM public.contacts WHERE email_normalized IS NOT NULL
  UNION ALL SELECT workspace_id, 'phone:' || phone_normalized, id FROM public.contacts WHERE phone_normalized IS NOT NULL
  UNION ALL SELECT workspace_id, 'domain:' || domain_normalized, id FROM public.contacts WHERE domain_normalized IS NOT NULL
) identities ORDER BY workspace_id, dedupe_key, contact_id
ON CONFLICT (workspace_id, dedupe_key) DO NOTHING;

INSERT INTO public.suppression_list(workspace_id, contact_id, suppression_type, normalized_value, reason)
SELECT workspace_id, id, 'email', email_normalized, 'contacted'
FROM public.contacts
WHERE email_normalized IS NOT NULL AND status IN ('contacted','waiting','replied','converted','closed')
ON CONFLICT (workspace_id, suppression_type, normalized_value) DO NOTHING;

NOTIFY pgrst, 'reload schema';
