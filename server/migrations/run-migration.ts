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
    
    // Migração original para custom_facilities
    const customFacilitiesFile = path.join(__dirname, 'add_custom_facilities.sql');
    console.log('Custom facilities migration file path:', customFacilitiesFile);
    const customFacilitiesSql = fs.readFileSync(customFacilitiesFile, 'utf8');
    
    // Migração para adicionar status finished e campo final_revenue
    const finalRevenueFile = path.join(__dirname, 'add-final-revenue.sql');
    console.log('Final revenue migration file path:', finalRevenueFile);
    const finalRevenueSql = fs.readFileSync(finalRevenueFile, 'utf8');
    
    // Execute the SQL migrations
    await pool.query(customFacilitiesSql);
    console.log('Custom facilities migration completed successfully!');
    
    await pool.query(finalRevenueSql);
    console.log('Final revenue migration completed successfully!');
    
    console.log('All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigration();