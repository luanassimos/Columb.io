-- Migration: Add address and maps_url to contacts table
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS maps_url TEXT;
