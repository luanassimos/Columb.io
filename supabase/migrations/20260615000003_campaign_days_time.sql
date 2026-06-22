-- Add new schedule_days and schedule_time columns and remove the old scheduled_at column
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS schedule_days INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS schedule_time TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE campaigns DROP COLUMN IF EXISTS scheduled_at;
