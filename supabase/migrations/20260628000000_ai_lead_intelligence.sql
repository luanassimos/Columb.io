-- AI Lead Intelligence base schema.
-- This migration is intentionally provider-agnostic and does not call any
-- external AI service. In the current app, leads are stored in public.contacts.

CREATE TABLE IF NOT EXISTS public.lead_evidence_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'website', 'social', 'directory', 'crm', 'other')),
  url TEXT,
  title TEXT,
  text_excerpt TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_analyzed' CHECK (
    status IN ('not_analyzed', 'prechecked', 'analyzing', 'qualified', 'needs_review', 'rejected', 'error')
  ),
  entity_type TEXT NOT NULL DEFAULT 'unknown' CHECK (entity_type IN ('business', 'person', 'unknown')),
  fit_score INTEGER NOT NULL DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
  grade TEXT NOT NULL DEFAULT 'D' CHECK (grade IN ('A', 'B', 'C', 'D')),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  opportunity_type TEXT NOT NULL DEFAULT 'unknown' CHECK (
    opportunity_type IN (
      'missing_website',
      'weak_website',
      'poor_social_presence',
      'coachmetric_fit',
      'columb_fit',
      'other',
      'unknown'
    )
  ),
  offer_angle TEXT,
  country_guess TEXT,
  language TEXT,
  summary TEXT,
  facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  inferences JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  unknowns JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_action TEXT NOT NULL DEFAULT 'review' CHECK (
    recommended_action IN ('reject', 'review', 'draft_email', 'enrich_more', 'create_campaign_candidate')
  ),
  evidence_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  cost_control_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT,
  provider TEXT NOT NULL DEFAULT 'mock',
  prompt_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.lead_ai_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES public.lead_ai_analyses(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'linkedin', 'phone', 'other')),
  subject TEXT,
  body TEXT NOT NULL,
  follow_up_body TEXT,
  language TEXT NOT NULL DEFAULT 'English',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.lead_evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_ai_drafts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_evidence_workspace ON public.lead_evidence_sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lead_evidence_lead ON public.lead_evidence_sources(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_evidence_source_type ON public.lead_evidence_sources(source_type);

CREATE INDEX IF NOT EXISTS idx_lead_ai_analyses_workspace ON public.lead_ai_analyses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lead_ai_analyses_lead ON public.lead_ai_analyses(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_ai_analyses_status ON public.lead_ai_analyses(workspace_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_ai_analyses_input_hash
  ON public.lead_ai_analyses(workspace_id, lead_id, input_hash);

CREATE INDEX IF NOT EXISTS idx_lead_ai_drafts_workspace ON public.lead_ai_drafts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lead_ai_drafts_lead ON public.lead_ai_drafts(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_ai_drafts_analysis ON public.lead_ai_drafts(analysis_id);
CREATE INDEX IF NOT EXISTS idx_lead_ai_drafts_status ON public.lead_ai_drafts(workspace_id, status);

CREATE OR REPLACE FUNCTION public.ensure_lead_ai_workspace_consistency()
RETURNS trigger AS $$
DECLARE
  contact_workspace_id UUID;
  analysis_workspace_id UUID;
  analysis_lead_id UUID;
BEGIN
  SELECT c.workspace_id
  INTO contact_workspace_id
  FROM public.contacts c
  WHERE c.id = NEW.lead_id;

  IF contact_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Lead not found for AI intelligence row';
  END IF;

  IF NEW.workspace_id <> contact_workspace_id THEN
    RAISE EXCEPTION 'AI intelligence workspace does not match lead workspace';
  END IF;

  IF TG_TABLE_NAME = 'lead_ai_drafts' THEN
    SELECT a.workspace_id, a.lead_id
    INTO analysis_workspace_id, analysis_lead_id
    FROM public.lead_ai_analyses a
    WHERE a.id = NEW.analysis_id;

    IF analysis_workspace_id IS NULL THEN
      RAISE EXCEPTION 'AI analysis not found for draft';
    END IF;

    IF analysis_workspace_id <> NEW.workspace_id OR analysis_lead_id <> NEW.lead_id THEN
      RAISE EXCEPTION 'AI draft does not match analysis workspace or lead';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS ensure_lead_evidence_workspace_consistency ON public.lead_evidence_sources;
CREATE TRIGGER ensure_lead_evidence_workspace_consistency
  BEFORE INSERT OR UPDATE OF workspace_id, lead_id ON public.lead_evidence_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_lead_ai_workspace_consistency();

DROP TRIGGER IF EXISTS ensure_lead_ai_analysis_workspace_consistency ON public.lead_ai_analyses;
CREATE TRIGGER ensure_lead_ai_analysis_workspace_consistency
  BEFORE INSERT OR UPDATE OF workspace_id, lead_id ON public.lead_ai_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_lead_ai_workspace_consistency();

DROP TRIGGER IF EXISTS ensure_lead_ai_draft_workspace_consistency ON public.lead_ai_drafts;
CREATE TRIGGER ensure_lead_ai_draft_workspace_consistency
  BEFORE INSERT OR UPDATE OF workspace_id, lead_id, analysis_id ON public.lead_ai_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_lead_ai_workspace_consistency();

DROP POLICY IF EXISTS "Lead evidence select workspace member" ON public.lead_evidence_sources;
CREATE POLICY "Lead evidence select workspace member" ON public.lead_evidence_sources
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Lead evidence insert editor" ON public.lead_evidence_sources;
CREATE POLICY "Lead evidence insert editor" ON public.lead_evidence_sources
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));

DROP POLICY IF EXISTS "Lead evidence update editor" ON public.lead_evidence_sources;
CREATE POLICY "Lead evidence update editor" ON public.lead_evidence_sources
  FOR UPDATE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));

DROP POLICY IF EXISTS "Lead evidence delete manager" ON public.lead_evidence_sources;
CREATE POLICY "Lead evidence delete manager" ON public.lead_evidence_sources
  FOR DELETE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager']));

DROP POLICY IF EXISTS "Lead analyses select workspace member" ON public.lead_ai_analyses;
CREATE POLICY "Lead analyses select workspace member" ON public.lead_ai_analyses
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Lead analyses insert editor" ON public.lead_ai_analyses;
CREATE POLICY "Lead analyses insert editor" ON public.lead_ai_analyses
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));

DROP POLICY IF EXISTS "Lead analyses update editor" ON public.lead_ai_analyses;
CREATE POLICY "Lead analyses update editor" ON public.lead_ai_analyses
  FOR UPDATE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));

DROP POLICY IF EXISTS "Lead analyses delete manager" ON public.lead_ai_analyses;
CREATE POLICY "Lead analyses delete manager" ON public.lead_ai_analyses
  FOR DELETE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager']));

DROP POLICY IF EXISTS "Lead drafts select workspace member" ON public.lead_ai_drafts;
CREATE POLICY "Lead drafts select workspace member" ON public.lead_ai_drafts
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Lead drafts insert editor" ON public.lead_ai_drafts;
CREATE POLICY "Lead drafts insert editor" ON public.lead_ai_drafts
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));

DROP POLICY IF EXISTS "Lead drafts update editor" ON public.lead_ai_drafts;
CREATE POLICY "Lead drafts update editor" ON public.lead_ai_drafts
  FOR UPDATE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));

DROP POLICY IF EXISTS "Lead drafts delete manager" ON public.lead_ai_drafts;
CREATE POLICY "Lead drafts delete manager" ON public.lead_ai_drafts
  FOR DELETE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager']));

DO $$
BEGIN
  IF to_regclass('public.leads') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_status TEXT NOT NULL DEFAULT ''not_analyzed''';
    EXECUTE 'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_score INTEGER';
    EXECUTE 'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_grade TEXT';
    EXECUTE 'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_summary TEXT';
    EXECUTE 'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_opportunity_type TEXT';
    EXECUTE 'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_language TEXT';
    EXECUTE 'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_ai_analyzed_at TIMESTAMPTZ';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
