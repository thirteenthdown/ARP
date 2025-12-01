-- Minimal init without PostGIS (lat/lng columns instead)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- users (anonymous-first)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  phone TEXT,
  email TEXT,
  kyc_submitted BOOLEAN DEFAULT FALSE,
  reputation INT DEFAULT 0,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  photo_url TEXT,
  severity SMALLINT,
  category TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_text TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- responses (volunteer offers / actions)
CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  volunteer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message TEXT,
  status TEXT DEFAULT 'offered',
  created_at TIMESTAMPTZ DEFAULT now()
);
