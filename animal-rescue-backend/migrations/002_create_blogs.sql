-- migrations/002_create_blogs.sql

CREATE TABLE IF NOT EXISTS blogs (
    id SERIAL PRIMARY KEY,
    -- CHANGED: INTEGER -> UUID to match your users table
    author_id UUID NOT NULL REFERENCES users(id), 
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[],
    photos TEXT[],
    videos TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster sorting
CREATE INDEX IF NOT EXISTS idx_blogs_created_at ON blogs(created_at DESC);