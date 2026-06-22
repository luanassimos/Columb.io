-- Add target_tags column to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_tags TEXT[] NOT NULL DEFAULT '{}';
