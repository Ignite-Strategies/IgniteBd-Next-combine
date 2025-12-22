#!/usr/bin/env node

/**
 * Resolve All Migration Conflicts
 * 
 * Keeps retrying until all migration conflicts are resolved.
 * Handles intermittent database connections.
 */

require('dotenv').config({ path: '.env.local' });
const { execSync } = require('child_process');

const MAX_RETRIES = 10;
const RETRY_DELAY = 3000; // 3 seconds

// Migrations in database that need to be marked as applied
const migrationsToResolve = [
  '$(date +%Y%m%d%H%M%S)_standardize_contact_model_to_singular',
  '$(date +%Y%m%d%H%M%S)_add_uuid_default_to_contact_id',
  '$(date +%Y%m%d%H%M%S)_work_package_company_first_refactor',
  '20251215185134_update_buying_readiness_enum',
  '20251219082237_add_email_campaigns_tracking',
  '20251221221845_add_has_growth_access_to_owners', // Old one we moved to company_hqs
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function resolveMigration(migrationName, attempt = 1) {
  if (attempt > MAX_RETRIES) {
    console.error(`❌ Failed to resolve ${migrationName} after ${MAX_RETRIES} attempts`);
    return false;
  }

  try {
    console.log(`🔄 Attempt ${attempt}/${MAX_RETRIES}: Resolving ${migrationName}...`);
    
    execSync(
      `npx prisma migrate resolve --applied "${migrationName}"`,
      { 
        stdio: 'inherit',
        env: { ...process.env }
      }
    );
    
    console.log(`✅ Successfully resolved: ${migrationName}\n`);
    return true;
  } catch (error) {
    if (error.message.includes('P1001') || error.message.includes("Can't reach database")) {
      console.log(`   ⚠️  Connection failed, retrying in ${RETRY_DELAY/1000}s...`);
      await sleep(RETRY_DELAY);
      return resolveMigration(migrationName, attempt + 1);
    } else if (error.message.includes('not found') || error.message.includes('does not exist')) {
      console.log(`   ℹ️  Migration not found in database (may already be resolved)\n`);
      return true; // Not an error, just already resolved
    } else {
      console.error(`   ❌ Error: ${error.message}`);
      await sleep(RETRY_DELAY);
      return resolveMigration(migrationName, attempt + 1);
    }
  }
}

async function resolveAllMigrations() {
  console.log('🔧 Resolving All Migration Conflicts\n');
  console.log(`Found ${migrationsToResolve.length} migrations to resolve\n`);
  console.log('='.repeat(60) + '\n');

  const results = [];
  
  for (const migrationName of migrationsToResolve) {
    const success = await resolveMigration(migrationName);
    results.push({ name: migrationName, success });
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:\n');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successfully resolved: ${successful}`);
  console.log(`❌ Failed: ${failed}\n`);

  if (failed === 0) {
    console.log('🎉 All migrations resolved!\n');
    console.log('Next steps:');
    console.log('1. Run: npx prisma migrate deploy');
    console.log('2. This will apply:');
    console.log('   - 20251220094821_add_sendgrid_verified_sender_fields');
    console.log('   - 20251221221845_add_has_growth_access_to_company_hqs');
    console.log('3. Then run: node scripts/seed-adam-growth-access.js');
    return 0;
  } else {
    console.log('⚠️  Some migrations failed to resolve.');
    console.log('You may need to resolve them manually or check database connectivity.');
    return 1;
  }
}

resolveAllMigrations().then(exitCode => process.exit(exitCode));

