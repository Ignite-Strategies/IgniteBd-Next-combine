#!/usr/bin/env node

/**
 * Safe Migration Creator
 * 
 * Creates Prisma migrations with proper naming and validation.
 * Prevents malformed migration names from shell variable expansion issues.
 * 
 * Usage:
 *   node scripts/create-migration.js "add_user_table"
 *   node scripts/create-migration.js "update_contacts_schema"
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Generate proper timestamp (YYYYMMDDHHMMSS format)
function generateTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// Validate migration name
function validateMigrationName(name) {
  if (!name || name.trim().length === 0) {
    throw new Error('Migration name cannot be empty');
  }
  
  // Remove any shell variable syntax that might cause issues
  if (name.includes('$(') || name.includes('${')) {
    throw new Error('Migration name cannot contain shell variables. Use plain text only.');
  }
  
  // Only allow alphanumeric, underscores, and hyphens
  if (!/^[a-z0-9_-]+$/i.test(name)) {
    throw new Error('Migration name can only contain letters, numbers, underscores, and hyphens');
  }
  
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

// Main function
function createMigration() {
  try {
    const migrationName = process.argv[2];
    
    if (!migrationName) {
      console.error('❌ Error: Migration name is required');
      console.log('\nUsage:');
      console.log('  node scripts/create-migration.js "migration_name"');
      console.log('\nExamples:');
      console.log('  node scripts/create-migration.js "add_user_table"');
      console.log('  node scripts/create-migration.js "update_contacts_schema"');
      process.exit(1);
    }
    
    // Validate migration name
    const safeName = validateMigrationName(migrationName);
    
    // Generate timestamp
    const timestamp = generateTimestamp();
    const fullMigrationName = `${timestamp}_${safeName}`;
    
    console.log('🔧 Creating Prisma migration...');
    console.log(`   Name: ${safeName}`);
    console.log(`   Full name: ${fullMigrationName}`);
    console.log('');
    
    // Check if migrations directory exists
    const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error('❌ Error: prisma/migrations directory not found');
      process.exit(1);
    }
    
    // Check if migration already exists
    const migrationPath = path.join(migrationsDir, fullMigrationName);
    if (fs.existsSync(migrationPath)) {
      console.error(`❌ Error: Migration ${fullMigrationName} already exists`);
      process.exit(1);
    }
    
    // Run Prisma migrate dev
    console.log('🚀 Running: npx prisma migrate dev...');
    try {
      execSync(
        `npx prisma migrate dev --name ${safeName} --create-only`,
        { 
          stdio: 'inherit',
          cwd: process.cwd(),
          env: { ...process.env }
        }
      );
      console.log('');
      console.log('✅ Migration created successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Edit the migration SQL file in:');
      console.log(`   prisma/migrations/${fullMigrationName}/migration.sql`);
      console.log('2. Review the changes');
      console.log('3. Apply the migration:');
      console.log('   npx prisma migrate deploy');
    } catch (error) {
      console.error('');
      console.error('❌ Error creating migration:', error.message);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createMigration();

