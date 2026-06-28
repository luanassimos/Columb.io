-- Add contact enrichment metadata columns to leads table
ALTER TABLE public.leads
ADD COLUMN contact_quality INTEGER NOT NULL DEFAULT 0,
ADD COLUMN contact_status TEXT NOT NULL DEFAULT 'pending' CHECK (contact_status IN ('pending', 'completed', 'failed')),
ADD COLUMN primary_contact TEXT,
ADD COLUMN contact_notes TEXT;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
