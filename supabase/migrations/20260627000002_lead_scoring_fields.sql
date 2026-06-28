-- Add rating, reviews, and scoring columns to leads table
ALTER TABLE public.leads
ADD COLUMN rating NUMERIC,
ADD COLUMN reviews_count INTEGER,
ADD COLUMN lead_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN lead_grade TEXT CHECK (lead_grade IN ('A', 'B', 'C', 'D')),
ADD COLUMN scoring_version INTEGER NOT NULL DEFAULT 1;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
