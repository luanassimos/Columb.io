-- Add maps_url column to contacts table
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS maps_url TEXT;
