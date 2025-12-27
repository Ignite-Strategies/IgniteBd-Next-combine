#!/usr/bin/env node

/**
 * Script to resolve migration drift between database and local migrations
 * 
 * This fixes the issue where database has migrations with placeholder names
 * that don't match local migration folders.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Use direct connection URL if available (for Neon pooler compatibility)
const directUrl = process.env.DIRECT_DATABASE_URL;
if (directUrl) {
  process.env.DATABASE_URL = directUrl;
  console.log('✅ Using DIRECT_DATABASE_URL for connection\n');
}

const prisma = new PrismaClient();

async function resolveMigrationDrift() {
  try {
    console.log('🔍 Checking migration drift...\n');

    // Get all local migrations
    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    const localMigrations = fs.readdirSync(migrationsDir)
      .filter(dir => {
        const dirPath = path.join(migrationsDir, dir);
        return fs.statSync(dirPath).isDirectory() && /^\d+_/.test(dir);
      })
      .sort();

    console.log(`📁 Found ${localMigrations.length} local migrations\n`);

    // Get database migrations
    const dbMigrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, applied_steps_count
      FROM _prisma_migrations
      ORDER BY started_at
    `;

    console.log(`🗄️  Found ${dbMigrations.length} database migrations\n`);

    // Mapping of database migration names (with placeholders) to local migration names
    const migrationMap = {
      '20251215185134_update_buying_readiness_enum': '20251215185134_add_buying_readiness_enum_values',
      '$(date +%Y%m%d%H%M%S)_standardize_contact_model_to_singular': '20251215192749_standardize_contact_model_to_singular',
      '$(date +%Y%m%d%H%M%S)_add_uuid_default_to_contact_id': '20251215205429_add_uuid_default_to_contact_id',
      '$(date +%Y%m%d%H%M%S)_work_package_company_first_refactor': '20251216153114_work_package_company_first_refactor',
      '20251219082237_add_email_campaigns_tracking': '20250130000000_add_email_campaigns_tracking',
    };

    // Update migration names in database
    for (const [dbName, localName] of Object.entries(migrationMap)) {
      const dbMigration = dbMigrations.find(m => m.migration_name === dbName);
      if (dbMigration) {
        console.log(`🔄 Updating: ${dbName} → ${localName}`);
        await prisma.$executeRaw`
          UPDATE _prisma_migrations
          SET migration_name = ${localName}
          WHERE migration_name = ${dbName}
        `;
        console.log(`   ✅ Updated\n`);
      }
    }

    // Check for any remaining drift
    const updatedMigrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, applied_steps_count
      FROM _prisma_migrations
      ORDER BY started_at
    `;

    console.log('📊 Updated migration names:\n');
    updatedMigrations.forEach(m => {
      console.log(`   - ${m.migration_name} (applied: ${m.finished_at ? '✅' : '❌'})`);
    });

    console.log('\n✅ Migration drift resolved!');
    console.log('\n💡 Next step: Run `npx prisma migrate status` to verify');

  } catch (error) {
    console.error('❌ Error resolving migration drift:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resolveMigrationDrift();

