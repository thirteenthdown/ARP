-- Add latitude and longitude columns to reports and sync from geom
ALTER TABLE reports ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Populate existing rows (if any) from PostGIS geom
UPDATE reports 
SET latitude = ST_Y(geom::geometry), 
    longitude = ST_X(geom::geometry) 
WHERE latitude IS NULL OR longitude IS NULL;
