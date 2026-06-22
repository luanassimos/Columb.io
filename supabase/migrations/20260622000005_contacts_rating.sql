-- Add rating column to contacts table with a check constraint (0 to 5 stars)
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5);
