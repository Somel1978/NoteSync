import { pool } from '../db';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('Running custom migrations...');
    
    // Read the SQL file
    const migrationFile = path.join(__dirname, 'add_customer_organization_notes.sql');
    console.log('Migration file path:', migrationFile);
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Execute the SQL
    await pool.query(sql);
    
    console.log('Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigration();