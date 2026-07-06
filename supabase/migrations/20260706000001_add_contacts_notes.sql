-- Add notes column to contacts table for personal comments
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS notes TEXT;
