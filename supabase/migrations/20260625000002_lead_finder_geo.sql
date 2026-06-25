-- Alter lead_finder_jobs table to add latitude, longitude, and radius
ALTER TABLE public.lead_finder_jobs 
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC,
  ADD COLUMN IF NOT EXISTS radius INTEGER;

-- Make region column nullable to support pure coordinates search
ALTER TABLE public.lead_finder_jobs 
  ALTER COLUMN region DROP NOT NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
