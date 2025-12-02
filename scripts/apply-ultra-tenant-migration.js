/**
 * Apply Ultra Tenant Migration
 * 
 * Applies the ultraTenantId foreign key migration directly to the database
 * 
 * Run: node scripts/apply-ultra-tenant-migration.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { readFileSync } = require('fs');
const { join } = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🚀 Applying Ultra Tenant migration...\n');

    // Read migration SQL
    const migrationPath = join(
      process.cwd(),
      'prisma/migrations/20250127000000_add_ultra_tenant_fk/migration.sql'
    );

    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log('📝 Migration SQL:', migrationSQL);

    // Split by semicolons
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`\n📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (!statement || statement.length < 5) continue;

      try {
        console.log(`  [${i + 1}/${statements.length}] Executing: ${statement.substring(0, 60)}...`);

        await prisma.$executeRawUnsafe(statement);

        console.log(`  ✅ Statement ${i + 1} executed successfully`);
      } catch (error) {
        // Check if column already exists (migration already applied)
        if (error.message?.includes('already exists') ||
            error.message?.includes('duplicate') ||
            error.message?.includes('column "ultraTenantId" already exists')) {
          console.log(`  ⚠️  Statement ${i + 1} skipped (already applied): ${error.message.split('\n')[0]}`);
        } else {
          console.error(`  ❌ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n✅ Migration applied successfully!');
    console.log('\n📊 Next steps:');
    console.log('   1. Run seed script: node scripts/set-ultra-tenant.js');
    console.log('   2. Generate Prisma client: npx prisma generate');
    console.log('   3. Test switchboard: Navigate to /admin/switchboard');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

