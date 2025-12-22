/**
 * Resolve Migration Conflicts
 * 
 * This script resolves the migration conflicts between the database
 * and local migration files. It marks duplicate migrations as applied.
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Migrations in database that don't match local files (duplicates with different names)
const migrationsToResolve = [
  '$(date +%Y%m%d%H%M%S)_standardize_contact_model_to_singular', // Local: 20251215192749_standardize_contact_model_to_singular
  '$(date +%Y%m%d%H%M%S)_add_uuid_default_to_contact_id', // Local: 20251215205429_add_uuid_default_to_contact_id
  '$(date +%Y%m%d%H%M%S)_work_package_company_first_refactor', // Local: 20251216153114_work_package_company_first_refactor
  '20251215185134_update_buying_readiness_enum', // Local: 20251215185134_add_buying_readiness_enum_values
  '20251219082237_add_email_campaigns_tracking', // Local: 20250130000000_add_email_campaigns_tracking
];

async function resolveMigrations() {
  try {
    console.log('🔧 Resolving migration conflicts...\n');

    for (const migrationName of migrationsToResolve) {
      try {
        // Check if migration exists in database
        const migration = await prisma.$queryRaw`
          SELECT migration_name, finished_at, rolled_back_at 
          FROM _prisma_migrations 
          WHERE migration_name = ${migrationName}
        `;

        if (migration && migration.length > 0) {
          const m = migration[0];
          if (m.finished_at && !m.rolled_back_at) {
            console.log(`✅ ${migrationName} - Already applied`);
          } else {
            // Mark as applied
            await prisma.$executeRaw`
              UPDATE _prisma_migrations 
              SET finished_at = NOW(), rolled_back_at = NULL
              WHERE migration_name = ${migrationName}
            `;
            console.log(`✅ ${migrationName} - Marked as applied`);
          }
        } else {
          console.log(`⚠️  ${migrationName} - Not found in database`);
        }
      } catch (error) {
        console.error(`❌ Error resolving ${migrationName}:`, error.message);
      }
    }

    console.log('\n✅ Migration resolution complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma migrate deploy');
    console.log('2. This will apply: 20251220094821_add_sendgrid_verified_sender_fields');
    console.log('3. Then apply: 20251221221845_add_has_growth_access_to_company_hqs');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resolveMigrations();

