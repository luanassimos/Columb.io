-- Add only_email column to lead_finder_jobs table
ALTER TABLE public.lead_finder_jobs
ADD COLUMN only_email BOOLEAN NOT NULL DEFAULT FALSE;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
