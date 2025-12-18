import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Known IDs from the audit
const IGNITEBD_HQ_ID = 'cmj2pif3w0003nwyxyekgcebi';
const ADAM_OWNER_ID = 'cmj07e84g0000l404ud7g48a3';
const ADAM_SUPERADMIN_ID = 'cmj2pif2g0001nwyxwmrf7x28';

async function migrate() {
  console.log('🚀 Starting Platform Model Migration...\n');

  try {
    // Step 1: Create platform table
    console.log('1️⃣ Creating platform table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Platform table created\n');

    // Step 2: Add platformId to company_hqs
    console.log('2️⃣ Adding platformId column to company_hqs...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE company_hqs 
      ADD COLUMN IF NOT EXISTS "platformId" TEXT;
    `);
    console.log('✅ platformId column added to company_hqs\n');

    // Step 3: Add platformId to super_admins
    console.log('3️⃣ Adding platformId column to super_admins...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE super_admins 
      ADD COLUMN IF NOT EXISTS "platformId" TEXT;
    `);
    console.log('✅ platformId column added to super_admins\n');

    // Step 4: Seed IgniteBD Platform
    console.log('4️⃣ Seeding IgniteBD Platform...');
    const platformId = 'platform-ignitebd-001';
    
    // Check if platform already exists
    const existingPlatform = await prisma.$queryRawUnsafe(`
      SELECT id FROM platform WHERE id = '${platformId}';
    `);

    if (existingPlatform && existingPlatform.length > 0) {
      console.log('⚠️  Platform already exists, skipping...');
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO platform (id, name, "createdAt", "updatedAt")
        VALUES (
          '${platformId}',
          'IgniteBD Platform',
          NOW(),
          NOW()
        );
      `);
      console.log(`✅ Platform created: ${platformId}\n`);
    }

    // Step 5: Link IgniteBD CompanyHQ to platform
    console.log('5️⃣ Linking IgniteBD CompanyHQ to platform...');
    await prisma.$executeRawUnsafe(`
      UPDATE company_hqs 
      SET "platformId" = '${platformId}'
      WHERE id = '${IGNITEBD_HQ_ID}';
    `);
    console.log(`✅ IgniteBD HQ linked to platform\n`);

    // Step 6: Link Adam's SuperAdmin to platform
    console.log('6️⃣ Linking Adam as SuperAdmin to platform...');
    await prisma.$executeRawUnsafe(`
      UPDATE super_admins 
      SET "platformId" = '${platformId}'
      WHERE id = '${ADAM_SUPERADMIN_ID}';
    `);
    console.log(`✅ Adam's SuperAdmin linked to platform\n`);

    // Step 7: Add foreign key constraints (with indexes)
    console.log('7️⃣ Adding indexes and foreign keys...');
    
    // Index on company_hqs.platformId
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "company_hqs_platformId_idx" 
      ON company_hqs("platformId");
    `);
    console.log('✅ Index created on company_hqs.platformId');

    // Index on super_admins.platformId
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "super_admins_platformId_idx" 
      ON super_admins("platformId");
    `);
    console.log('✅ Index created on super_admins.platformId');

    // Foreign key on company_hqs.platformId
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'company_hqs_platformId_fkey'
        ) THEN
          ALTER TABLE company_hqs
          ADD CONSTRAINT "company_hqs_platformId_fkey"
          FOREIGN KEY ("platformId") REFERENCES platform(id)
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    console.log('✅ Foreign key constraint added to company_hqs');

    // Foreign key on super_admins.platformId
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'super_admins_platformId_fkey'
        ) THEN
          ALTER TABLE super_admins
          ADD CONSTRAINT "super_admins_platformId_fkey"
          FOREIGN KEY ("platformId") REFERENCES platform(id)
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    console.log('✅ Foreign key constraint added to super_admins\n');

    // Step 8: Verify migration
    console.log('8️⃣ Verifying migration...\n');
    
    // Check platform
    const platform = await prisma.$queryRawUnsafe(`
      SELECT * FROM platform WHERE id = '${platformId}';
    `);
    console.log('Platform:', platform[0]);

    // Check IgniteBD HQ
    const hq = await prisma.$queryRawUnsafe(`
      SELECT id, "companyName", "platformId", "ultraTenantId" 
      FROM company_hqs WHERE id = '${IGNITEBD_HQ_ID}';
    `);
    console.log('\nIgniteBD HQ:', hq[0]);

    // Check SuperAdmin
    const admin = await prisma.$queryRawUnsafe(`
      SELECT id, "ownerId", "platformId" 
      FROM super_admins WHERE id = '${ADAM_SUPERADMIN_ID}';
    `);
    console.log('\nSuperAdmin:', admin[0]);

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Update code to use platformId instead of ultraTenantId');
    console.log('   2. Test switchboard and tenant creation');
    console.log('   3. Remove ultraTenantId field after verification');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrate()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
