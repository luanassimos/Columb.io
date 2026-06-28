-- Drop existing status check constraint if it exists
ALTER TABLE public.lead_finder_jobs DROP CONSTRAINT IF EXISTS lead_finder_jobs_status_check;

-- Add updated status check constraint including 'cancelled'
ALTER TABLE public.lead_finder_jobs ADD CONSTRAINT lead_finder_jobs_status_check 
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
