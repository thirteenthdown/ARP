require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./src/db');

// Ensure SSL handling matches what we did in db.js
// Actually db.js already handles it based on process.env.DATABASE_URL
// so we just need to Require it.

async function migrate() {
  try {
    const migrationDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ensure 001 runs before 002 etc.

    console.log(`Found ${files.length} migration files.`);

    for (const file of files) {
      console.log(`Running ${file}...`);
      const filePath = path.join(migrationDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      await db.query(sql);
      console.log(`✓ ${file} executed.`);
    }

    console.log("All migrations completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration Failed:", err);
    process.exit(1);
  }
}

migrate();
