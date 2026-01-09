-- migrations/003_update_reports_schema.sql

-- Add new columns for the updated form
ALTER TABLE reports ADD COLUMN IF NOT EXISTS animal_type TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS address TEXT;

-- Ensure media arrays exist (photos might exist, videos is likely new)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS photos TEXT[];
ALTER TABLE reports ADD COLUMN IF NOT EXISTS videos TEXT[];