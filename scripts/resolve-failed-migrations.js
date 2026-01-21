#!/usr/bin/env node

/**
 * Resolve All Failed Migrations
 * 
 * This script finds all failed migrations in the database and marks them as applied
 * using Prisma's built-in `migrate resolve` command, which is the safest approach.
 * 
 * Usage:
 *   node scripts/resolve-failed-migrations.js
 * 
 * Or with explicit DATABASE_URL:
 *   DATABASE_URL="postgresql://..." node scripts/resolve-failed-migrations.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function resolveFailedMigrations() {
  try {
    console.log('🔍 Finding failed migrations in database...\n');

    // Find all failed migrations (where finished_at is NULL or rolled_back_at is not NULL)
    const failedMigrations = await prisma.$queryRaw`
      SELECT 
        migration_name,
        started_at,
        finished_at,
        rolled_back_at,
        applied_steps_count
      FROM _prisma_migrations
      WHERE finished_at IS NULL
         OR rolled_back_at IS NOT NULL
      ORDER BY started_at ASC
    `;

    if (!failedMigrations || failedMigrations.length === 0) {
      console.log('✅ No failed migrations found!');
      return;
    }

    console.log(`Found ${failedMigrations.length} failed migration(s):\n`);
    
    failedMigrations.forEach((migration, index) => {
      console.log(`${index + 1}. ${migration.migration_name}`);
      console.log(`   Started: ${migration.started_at}`);
      console.log(`   Finished: ${migration.finished_at || 'NULL (failed)'}`);
      console.log(`   Rolled back: ${migration.rolled_back_at || 'No'}`);
      console.log('');
    });

    console.log('⚠️  WARNING: This will mark all failed migrations as applied.');
    console.log('   Make sure the schema changes were actually applied to the database.\n');
    console.log('   Using Prisma\'s built-in resolve command for safety...\n');

    // Mark each failed migration as applied using Prisma's resolve command
    let successCount = 0;
    let errorCount = 0;

    for (const migration of failedMigrations) {
      try {
        console.log(`🔄 Resolving: ${migration.migration_name}`);
        
        // Use Prisma's built-in resolve command
        execSync(
          `npx prisma migrate resolve --applied "${migration.migration_name}"`,
          { 
            stdio: 'inherit',
            env: { ...process.env }
          }
        );
        
        console.log(`✅ Marked as applied: ${migration.migration_name}\n`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error resolving ${migration.migration_name}:`, error.message);
        errorCount++;
        console.log('');
      }
    }

    console.log('='.repeat(60));
    console.log('📊 Summary:');
    console.log(`✅ Successfully resolved: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (successCount > 0) {
      console.log('✅ All failed migrations have been marked as applied!\n');
      console.log('Next steps:');
      console.log('1. Run: npx prisma migrate deploy');
      console.log('2. This should now proceed without migration conflicts');
      console.log('3. Verify your schema is in sync with: npx prisma migrate status\n');
    }

    if (errorCount > 0) {
      console.log('⚠️  Some migrations failed to resolve.');
      console.log('   You may need to resolve them manually.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
resolveFailedMigrations();





