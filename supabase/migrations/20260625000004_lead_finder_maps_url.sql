-- Alter leads table to add maps_url
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS maps_url TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
