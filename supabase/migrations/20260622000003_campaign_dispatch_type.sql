-- Add dispatch_type column to campaigns table
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS dispatch_type TEXT NOT NULL DEFAULT 'scheduled'
  CONSTRAINT campaigns_dispatch_type_check CHECK (dispatch_type IN ('scheduled', 'immediate'));

NOTIFY pgrst, 'reload schema';
