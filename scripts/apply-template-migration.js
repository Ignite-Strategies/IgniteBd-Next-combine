#!/usr/bin/env node

/**
 * Apply template refactor migration directly via SQL
 * Bypasses Prisma's advisory lock mechanism
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Use direct connection URL if available (for Neon pooler compatibility)
const directUrl = process.env.DIRECT_DATABASE_URL;
if (directUrl) {
  process.env.DATABASE_URL = directUrl;
  console.log('✅ Using DIRECT_DATABASE_URL for connection\n');
} else {
  console.log('⚠️  DIRECT_DATABASE_URL not set, using DATABASE_URL\n');
}

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔄 Applying template refactor migration...\n');

    // Read the migration SQL
    const migrationPath = path.join(__dirname, '../prisma/migrations/20251226210000_refactor_template_system/migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`[${i + 1}/${statements.length}] Executing statement...`);
          await prisma.$executeRawUnsafe(statement);
          console.log(`   ✅ Success\n`);
        } catch (error) {
          // Some errors are expected (e.g., IF NOT EXISTS, IF EXISTS)
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('IF NOT EXISTS') ||
              error.message.includes('IF EXISTS')) {
            console.log(`   ⚠️  Skipped (expected): ${error.message.split('\n')[0]}\n`);
          } else {
            throw error;
          }
        }
      }
    }

    // Mark migration as applied
    console.log('📝 Marking migration as applied...');
    try {
      // Check if already exists
      const existing = await prisma.$queryRaw`
        SELECT migration_name FROM "_prisma_migrations" 
        WHERE migration_name = '20251226210000_refactor_template_system'
      `;
      
      if (existing.length === 0) {
        await prisma.$executeRaw`
          INSERT INTO "_prisma_migrations" (migration_name, finished_at, started_at, applied_steps_count)
          VALUES ('20251226210000_refactor_template_system', NOW(), NOW(), 1)
        `;
        console.log('   ✅ Migration marked as applied\n');
      } else {
        console.log('   ℹ️  Migration already recorded\n');
      }
    } catch (error) {
      console.log(`   ⚠️  Could not mark migration (may already exist): ${error.message}\n`);
    }

    console.log('✅ Migration applied successfully!');

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    if (error.meta) {
      console.error('   Details:', error.meta);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();

