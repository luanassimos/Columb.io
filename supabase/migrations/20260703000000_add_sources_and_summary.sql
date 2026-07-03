-- Add sources column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS sources JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Populate sources for existing company leads
UPDATE public.leads 
SET sources = '["google_maps"]'::jsonb 
WHERE lead_entity_type = 'company' AND lead_origin = 'maps' AND (sources IS NULL OR sources = '[]'::jsonb);

-- Populate sources for existing professional leads
UPDATE public.leads 
SET sources = '["linkedin"]'::jsonb 
WHERE lead_entity_type = 'professional' AND lead_origin = 'linkedin' AND (sources IS NULL OR sources = '[]'::jsonb);

-- Add execution_summary column to lead_finder_jobs table
ALTER TABLE public.lead_finder_jobs 
ADD COLUMN IF NOT EXISTS execution_summary JSONB DEFAULT NULL;

-- Reload schema
NOTIFY pgrst, 'reload schema';
