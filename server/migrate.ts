import { db } from './db';
import { sql } from 'drizzle-orm';

// For non-destructively updating the schema to include new columns
async function migrateSchema() {
  console.log('Starting schema migration...');
  
  try {
    // Add latitude and longitude to locations table (if they don't exist)
    await db.execute(sql`
      ALTER TABLE IF EXISTS locations 
      ADD COLUMN IF NOT EXISTS latitude double precision,
      ADD COLUMN IF NOT EXISTS longitude double precision;
    `);
    console.log('Updated locations table with latitude and longitude');
    
    // Add membership_number to appointments table (if it doesn't exist)
    await db.execute(sql`
      ALTER TABLE IF EXISTS appointments 
      ADD COLUMN IF NOT EXISTS membership_number text;
    `);
    console.log('Updated appointments table with membership_number');
    
    console.log('Schema migration completed successfully');
  } catch (error) {
    console.error('Error during schema migration:', error);
    process.exit(1);
  }
}

migrateSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error during migration:', error);
    process.exit(1);
  });