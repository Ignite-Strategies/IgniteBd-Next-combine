#!/usr/bin/env node

/**
 * Apply inboundType nullable + backfill without relying on Prisma migration history.
 * Use when migrate dev fails due to drift; run this against the target DB instead.
 *
 * Run: node scripts/backfill-inbound-type.js
 *
 * Requires: DATABASE_URL or DIRECT_DATABASE_URL (same as migrate-deploy.js)
 */

const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

// Load .env.local if it exists (for local development)
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

const directUrl = process.env.DIRECT_DATABASE_URL;
if (directUrl) {
  process.env.DATABASE_URL = directUrl;
}

const prisma = new PrismaClient();

async function run() {
  console.log('🔄 Applying inboundType (create if missing, or allow null + backfill)...\n');

  try {
    // Check if column already exists
    const hasColumn = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'InboundEmail' AND column_name = 'inboundType';
    `);
    const columnExists = Array.isArray(hasColumn) && hasColumn.length > 0;

    if (!columnExists) {
      console.log('Column inboundType missing — creating enum + column (NOT NULL DEFAULT OUTREACH)...');
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "InboundType" AS ENUM ('OUTREACH', 'MEETING');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
      console.log('✅ Enum InboundType');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "InboundEmail" ADD COLUMN "inboundType" "InboundType" NOT NULL DEFAULT 'OUTREACH';
      `);
      console.log('✅ Added column inboundType (existing rows get OUTREACH)');
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "InboundEmail_inboundType_idx" ON "InboundEmail"("inboundType");
      `);
      console.log('✅ Index');
      console.log('\n✅ Done. Inbound Parse list will show existing emails.');
      return;
    }

    // Column exists: allow null and backfill any nulls
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "InboundEmail" ALTER COLUMN "inboundType" DROP NOT NULL;
    `);
    console.log('✅ inboundType: DROP NOT NULL');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "InboundEmail" ALTER COLUMN "inboundType" DROP DEFAULT;
    `);
    console.log('✅ inboundType: DROP DEFAULT');
    const updateResult = await prisma.$executeRawUnsafe(`
      UPDATE "InboundEmail" SET "inboundType" = 'OUTREACH' WHERE "inboundType" IS NULL;
    `);
    console.log(`✅ Backfilled inboundType = 'OUTREACH' for ${updateResult} row(s)\n`);
    console.log('✅ Done. Outreach list API will include rows where inboundType is OUTREACH or null.');
  } catch (e) {
    console.error('❌ Error:', e.message);
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
