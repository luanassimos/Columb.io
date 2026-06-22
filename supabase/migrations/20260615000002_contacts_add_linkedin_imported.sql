-- Migration: Add linkedin_url and imported_at to contacts table
-- Run this in your Supabase SQL Editor

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT now();
