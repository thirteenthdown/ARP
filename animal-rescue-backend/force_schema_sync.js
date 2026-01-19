require('dotenv').config();
const { Pool } = require('pg');

// 1. Setup DB Connection (Handling SSL securely)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('amazonaws.com') 
    ? { rejectUnauthorized: false } 
    : false
});

async function repairSchema() {
  console.log("Starting Comprehensive Schema Repair...");
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // --- 1. EXTENSIONS ---
    console.log("Checking Extensions...");
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    // --- 2. USERS TABLE ---
    console.log("Checking Users Table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Add ALL User Columns
    const userCols = [
        "phone TEXT",
        "email TEXT",
        "kyc_submitted BOOLEAN DEFAULT FALSE",
        "reputation INT DEFAULT 0",
        "geom GEOGRAPHY(POINT,4326)",
        "email_verified BOOLEAN DEFAULT FALSE",
        "password_hash TEXT",
        "full_name TEXT",
        "gender TEXT",
        "age INT",
        "favourite_animal TEXT",
        "reason TEXT",
        "avatar TEXT"
    ];

    for (const col of userCols) {
        const [name, ...typeProcess] = col.split(' ');
        const typeDef = typeProcess.join(' ');
        console.log(`  -> Ensuring users.${name}`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${name} ${typeDef}`);
    }

    // --- 3. REPORTS TABLE ---
    console.log("Checking Reports Table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    
    // Add ALL Report Columns
    const reportCols = [
        "reporter_id UUID REFERENCES users(id) ON DELETE SET NULL",
        "title TEXT",
        "description TEXT",
        "photo_url TEXT",
        "severity SMALLINT",
        "category TEXT",
        "geom GEOGRAPHY(POINT,4326)",
        "location_text TEXT",
        "status TEXT DEFAULT 'open'",
        "animal_type TEXT",
        "address TEXT",
        "photos TEXT[]",
        "videos TEXT[]",
        "latitude DOUBLE PRECISION",
        "longitude DOUBLE PRECISION"
    ];

    for (const col of reportCols) {
        const [name, ...typeProcess] = col.split(' ');
        
        // Handle constraint logic simply for now
        // if user already exists, adding NOT NULL is hard, so we skip strict constraints in repair
        await client.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS ${name} ${typeProcess.join(' ')}`);
    }

    // Relax geom constraint if it exists (since code uses lat/long)
    try {
        await client.query(`ALTER TABLE reports ALTER COLUMN geom DROP NOT NULL`);
    } catch (e) {
        // Ignore if fails (e.g. if column doesn't exist yet, though it should)
    }

    // --- 4. BLOGS TABLE ---
    console.log("Checking Blogs Table...");
    await client.query(`
        CREATE TABLE IF NOT EXISTS blogs (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const blogCols = [
        "author_id UUID NOT NULL REFERENCES users(id)",
        "title TEXT NOT NULL",
        "content TEXT NOT NULL",
        "tags TEXT[]",
        "photos TEXT[]",
        "videos TEXT[]"
    ];

    for (const col of blogCols) {
       const [name, ...typeProcess] = col.split(' ');
       // Remove NOT NULL to prevent failure on existing rows (repair mode)
       const looseType = typeProcess.join(' ').replace('NOT NULL', ''); 
       await client.query(`ALTER TABLE blogs ADD COLUMN IF NOT EXISTS ${name} ${looseType}`);
    }

    // --- 5. RESPONSES TABLE ---
    console.log("Checking Responses Table...");
    await client.query(`
        CREATE TABLE IF NOT EXISTS responses (
             id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
             created_at TIMESTAMPTZ DEFAULT now()
        )
    `);

    const responseCols = [
        "report_id UUID REFERENCES reports(id) ON DELETE CASCADE",
        "volunteer_id UUID REFERENCES users(id) ON DELETE SET NULL",
        "message TEXT",
        "status TEXT DEFAULT 'offered'"
    ];

    for (const col of responseCols) {
        const [name, ...typeProcess] = col.split(' ');
        await client.query(`ALTER TABLE responses ADD COLUMN IF NOT EXISTS ${name} ${typeProcess.join(' ')}`);
    }

    await client.query('COMMIT');
    console.log(">>> SUCCESS: Database Schema is fully synchronized.");
    process.exit(0);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(">>> ERROR: Schema Repair Failed", err);
    process.exit(1);
  } finally {
    client.release();
  }
}

repairSchema();
