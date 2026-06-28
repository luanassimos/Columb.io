-- Alter leads table to add latitude, longitude, and email
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC,
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
