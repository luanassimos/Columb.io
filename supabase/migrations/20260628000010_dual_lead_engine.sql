-- Alter public.leads table to support dual lead engine
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS lead_entity_type TEXT NOT NULL DEFAULT 'company' CHECK (lead_entity_type IN ('company', 'professional')),
ADD COLUMN IF NOT EXISTS lead_origin TEXT NOT NULL DEFAULT 'maps',
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Alter public.lead_finder_jobs to support entity types and keywords
ALTER TABLE public.lead_finder_jobs
ADD COLUMN IF NOT EXISTS lead_entity_type TEXT NOT NULL DEFAULT 'company' CHECK (lead_entity_type IN ('company', 'professional')),
ADD COLUMN IF NOT EXISTS keywords TEXT;

-- Create company_leads table
CREATE TABLE IF NOT EXISTS public.company_leads (
  lead_id UUID PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  address TEXT,
  category TEXT,
  contact_score INTEGER NOT NULL DEFAULT 0,
  contact_completeness NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create professional_leads table
CREATE TABLE IF NOT EXISTS public.professional_leads (
  lead_id UUID PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  professional_role TEXT,
  industry TEXT,
  location TEXT,
  profile_url TEXT,
  contact_channel TEXT,
  professional_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.company_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Company leads workspace member" ON public.company_leads;
CREATE POLICY "Company leads workspace member" ON public.company_leads
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = company_leads.lead_id AND public.is_workspace_member(l.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = company_leads.lead_id AND public.is_workspace_member(l.workspace_id)
  ));

DROP POLICY IF EXISTS "Professional leads workspace member" ON public.professional_leads;
CREATE POLICY "Professional leads workspace member" ON public.professional_leads
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = professional_leads.lead_id AND public.is_workspace_member(l.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = professional_leads.lead_id AND public.is_workspace_member(l.workspace_id)
  ));

-- Create trigger function to sync leads where lead_entity_type = 'company'
CREATE OR REPLACE FUNCTION public.sync_company_leads()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_entity_type = 'company' THEN
    INSERT INTO public.company_leads (
      lead_id, 
      company_name, 
      website, 
      phone, 
      address, 
      category, 
      contact_score, 
      contact_completeness,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.name,
      NEW.website,
      NEW.phone,
      NEW.address,
      NEW.category,
      COALESCE(NEW.contact_score, 0),
      (
        (CASE WHEN NEW.phone IS NOT NULL AND NEW.phone <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN NEW.website IS NOT NULL AND NEW.website <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN NEW.address IS NOT NULL AND NEW.address <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN NEW.email IS NOT NULL AND NEW.email <> '' THEN 1 ELSE 0 END)
      )::NUMERIC / 4.0 * 100.0,
      NEW.updated_at
    )
    ON CONFLICT (lead_id) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      website = EXCLUDED.website,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      category = EXCLUDED.category,
      contact_score = EXCLUDED.contact_score,
      contact_completeness = EXCLUDED.contact_completeness,
      updated_at = EXCLUDED.updated_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for syncing leads to company_leads
DROP TRIGGER IF EXISTS trg_sync_company_leads ON public.leads;
CREATE TRIGGER trg_sync_company_leads
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_company_leads();

-- Populate existing company leads
INSERT INTO public.company_leads (
  lead_id, 
  company_name, 
  website, 
  phone, 
  address, 
  category, 
  contact_score, 
  contact_completeness
)
SELECT 
  id, 
  name, 
  website, 
  phone, 
  address, 
  category, 
  COALESCE(contact_score, 0),
  (
    (CASE WHEN phone IS NOT NULL AND phone <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN website IS NOT NULL AND website <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN address IS NOT NULL AND address <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN email IS NOT NULL AND email <> '' THEN 1 ELSE 0 END)
  )::NUMERIC / 4.0 * 100.0
FROM public.leads
ON CONFLICT (lead_id) DO NOTHING;

-- Reload schema
NOTIFY pgrst, 'reload schema';
