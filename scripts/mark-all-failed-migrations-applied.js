#!/usr/bin/env node

/**
 * Mark All Failed Migrations as Applied
 * 
 * This script finds all failed migrations in the database and marks them as applied.
 * This is useful when migrations failed due to transient issues but the schema changes
 * were actually applied successfully.
 * 
 * Usage:
 *   node scripts/mark-all-failed-migrations-applied.js
 * 
 * Or with explicit DATABASE_URL:
 *   DATABASE_URL="postgresql://..." node scripts/mark-all-failed-migrations-applied.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function markFailedMigrationsAsApplied() {
  try {
    console.log('🔍 Finding failed migrations in database...\n');

    // Find all failed migrations (where finished_at is NULL or migration failed)
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
      console.log(`   Applied steps: ${migration.applied_steps_count || 0}`);
      console.log('');
    });

    console.log('⚠️  WARNING: This will mark all failed migrations as applied.');
    console.log('   Make sure the schema changes were actually applied to the database.\n');

    // Mark each failed migration as applied
    let successCount = 0;
    let errorCount = 0;

    for (const migration of failedMigrations) {
      try {
        // Get the migration file to determine applied_steps_count
        const fs = require('fs');
        const path = require('path');
        const migrationPath = path.join(
          __dirname,
          '..',
          'prisma',
          'migrations',
          migration.migration_name,
          'migration.sql'
        );

        let appliedStepsCount = migration.applied_steps_count || 1; // Use existing or default to 1
        if (fs.existsSync(migrationPath)) {
          const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
          // Count the number of statements (rough estimate - count semicolons that end statements)
          const statements = migrationSQL
            .split(';')
            .filter(s => {
              const trimmed = s.trim();
              return trimmed.length > 0 && !trimmed.startsWith('--');
            });
          appliedStepsCount = Math.max(1, statements.length);
        }

        // Mark as applied - set finished_at to started_at + 1 second if not already set
        // This mimics what Prisma does when a migration completes successfully
        const finishedAt = migration.finished_at 
          ? new Date(migration.finished_at)
          : new Date(new Date(migration.started_at).getTime() + 1000);

        await prisma.$executeRaw`
          UPDATE _prisma_migrations 
          SET 
            finished_at = ${finishedAt}::timestamp,
            rolled_back_at = NULL,
            applied_steps_count = ${appliedStepsCount}
          WHERE migration_name = ${migration.migration_name}
        `;

        console.log(`✅ Marked as applied: ${migration.migration_name}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error marking ${migration.migration_name} as applied:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`✅ Successfully marked: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (successCount > 0) {
      console.log('✅ All failed migrations have been marked as applied!\n');
      console.log('Next steps:');
      console.log('1. Run: npx prisma migrate deploy');
      console.log('2. This should now proceed without migration conflicts');
      console.log('3. Verify your schema is in sync with: npx prisma migrate status\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
markFailedMigrationsAsApplied();

