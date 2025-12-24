#!/usr/bin/env node

/**
 * Resolve all failed migrations by directly querying the database
 * Uses pg library to connect and update _prisma_migrations table
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

async function resolveAllFailedMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log('🌙 Connecting to database (this may take a moment if it\'s sleeping)...\n');
    
    await client.connect();
    console.log('✅ Connected to database!\n');

    // Find all failed migrations
    const result = await client.query(`
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
    `);

    if (result.rows.length === 0) {
      console.log('✅ No failed migrations found!');
      return;
    }

    console.log(`Found ${result.rows.length} failed migration(s):\n`);
    
    result.rows.forEach((migration, index) => {
      console.log(`${index + 1}. ${migration.migration_name}`);
      console.log(`   Started: ${migration.started_at}`);
      console.log(`   Finished: ${migration.finished_at || 'NULL (failed)'}`);
      console.log(`   Rolled back: ${migration.rolled_back_at || 'No'}`);
      console.log('');
    });

    console.log('⚠️  Marking all failed migrations as applied...\n');

    // Mark all as applied
    const updateResult = await client.query(`
      UPDATE _prisma_migrations 
      SET 
        finished_at = COALESCE(finished_at, started_at + INTERVAL '1 second'),
        rolled_back_at = NULL,
        applied_steps_count = COALESCE(applied_steps_count, 1)
      WHERE finished_at IS NULL
         OR rolled_back_at IS NOT NULL
      RETURNING migration_name
    `);

    console.log(`✅ Successfully marked ${updateResult.rows.length} migration(s) as applied:\n`);
    updateResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.migration_name}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ All failed migrations have been marked as applied!\n');
    console.log('Next steps:');
    console.log('1. Run: npx prisma migrate deploy');
    console.log('2. This should now proceed without migration conflicts');
    console.log('3. Verify your schema is in sync with: npx prisma migrate status\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Neon databases can take 10-30 seconds to wake up.');
      console.error('   Try running this script again in a few moments.\n');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

resolveAllFailedMigrations();


