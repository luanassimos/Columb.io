-- Alter contact_quality type and add contact intelligence columns
ALTER TABLE public.leads DROP COLUMN contact_quality;
ALTER TABLE public.leads ADD COLUMN contact_quality TEXT NOT NULL DEFAULT 'low' CHECK (contact_quality IN ('low', 'medium', 'high'));

ALTER TABLE public.leads
ADD COLUMN contact_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN reachability_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN contact_channels JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
