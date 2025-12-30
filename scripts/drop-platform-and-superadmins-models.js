/**
 * Migration: Drop platform and super_admins models from IgniteBd-Next-combine
 * 
 * This script:
 * 1. Drops foreign key constraints from company_hqs.platformId
 * 2. Drops platformId column from company_hqs
 * 3. Drops super_admins table (and all its constraints/indexes)
 * 4. Drops platform table
 * 
 * Run: node scripts/drop-platform-and-superadmins-models.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function dropPlatformAndSuperAdmins() {
  try {
    console.log('🚀 Starting migration to drop platform and super_admins models...\n');

    // Step 1: Check current state
    console.log('1️⃣ Checking current state...');
    
    const platformExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'platform'
      );
    `;
    
    const superAdminsExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'super_admins'
      );
    `;
    
    const platformIdColumnExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'company_hqs' 
        AND column_name = 'platformId'
      );
    `;

    console.log(`   Platform table exists: ${platformExists[0].exists}`);
    console.log(`   Super_admins table exists: ${superAdminsExists[0].exists}`);
    console.log(`   company_hqs.platformId column exists: ${platformIdColumnExists[0].exists}`);
    console.log('');

    // Step 2: Drop foreign key constraint from company_hqs.platformId
    if (platformIdColumnExists[0].exists) {
      console.log('2️⃣ Dropping foreign key constraint from company_hqs.platformId...');
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "company_hqs" DROP CONSTRAINT IF EXISTS "company_hqs_platformId_fkey";`
        );
        console.log('   ✅ Foreign key constraint dropped');
      } catch (error) {
        console.log('   ⚠️  Error dropping constraint (may not exist):', error.message);
      }
      console.log('');

      // Step 3: Drop index on company_hqs.platformId
      console.log('3️⃣ Dropping index on company_hqs.platformId...');
      try {
        await prisma.$executeRawUnsafe(
          `DROP INDEX IF EXISTS "company_hqs_platformId_idx";`
        );
        console.log('   ✅ Index dropped');
      } catch (error) {
        console.log('   ⚠️  Error dropping index (may not exist):', error.message);
      }
      console.log('');

      // Step 4: Drop platformId column from company_hqs
      console.log('4️⃣ Dropping platformId column from company_hqs...');
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "company_hqs" DROP COLUMN IF EXISTS "platformId";`
        );
        console.log('   ✅ Column dropped');
      } catch (error) {
        console.log('   ⚠️  Error dropping column:', error.message);
        throw error;
      }
      console.log('');
    } else {
      console.log('2️⃣-4️⃣ Skipping company_hqs.platformId operations (column does not exist)\n');
    }

    // Step 5: Drop super_admins table (with all constraints/indexes)
    if (superAdminsExists[0].exists) {
      console.log('5️⃣ Dropping super_admins table...');
      
      // First, drop foreign key constraints
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "super_admins" DROP CONSTRAINT IF EXISTS "super_admins_ownerId_fkey";`
        );
        console.log('   ✅ Dropped ownerId foreign key');
      } catch (error) {
        console.log('   ⚠️  ownerId foreign key may not exist:', error.message);
      }

      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "super_admins" DROP CONSTRAINT IF EXISTS "super_admins_platformId_fkey";`
        );
        console.log('   ✅ Dropped platformId foreign key');
      } catch (error) {
        console.log('   ⚠️  platformId foreign key may not exist:', error.message);
      }

      // Drop indexes
      try {
        await prisma.$executeRawUnsafe(
          `DROP INDEX IF EXISTS "super_admins_ownerId_key";`
        );
        console.log('   ✅ Dropped ownerId unique index');
      } catch (error) {
        console.log('   ⚠️  ownerId index may not exist:', error.message);
      }

      try {
        await prisma.$executeRawUnsafe(
          `DROP INDEX IF EXISTS "super_admins_platformId_idx";`
        );
        console.log('   ✅ Dropped platformId index');
      } catch (error) {
        console.log('   ⚠️  platformId index may not exist:', error.message);
      }

      try {
        await prisma.$executeRawUnsafe(
          `DROP INDEX IF EXISTS "super_admins_firebaseId_key";`
        );
        console.log('   ✅ Dropped firebaseId unique index');
      } catch (error) {
        console.log('   ⚠️  firebaseId index may not exist:', error.message);
      }

      try {
        await prisma.$executeRawUnsafe(
          `DROP INDEX IF EXISTS "super_admins_firebaseId_idx";`
        );
        console.log('   ✅ Dropped firebaseId index');
      } catch (error) {
        console.log('   ⚠️  firebaseId index may not exist:', error.message);
      }

      // Finally, drop the table
      try {
        await prisma.$executeRawUnsafe(
          `DROP TABLE IF EXISTS "super_admins";`
        );
        console.log('   ✅ Table dropped');
      } catch (error) {
        console.log('   ❌ Error dropping table:', error.message);
        throw error;
      }
      console.log('');
    } else {
      console.log('5️⃣ Skipping super_admins table (does not exist)\n');
    }

    // Step 6: Drop platform table
    if (platformExists[0].exists) {
      console.log('6️⃣ Dropping platform table...');
      
      // Check for foreign key constraints first
      const fkConstraints = await prisma.$queryRaw`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'platform'
        AND constraint_type = 'FOREIGN KEY';
      `;
      
      if (fkConstraints.length > 0) {
        console.log(`   Found ${fkConstraints.length} foreign key constraint(s) referencing platform`);
        // These should have been dropped when we dropped super_admins and company_hqs.platformId
      }

      try {
        await prisma.$executeRawUnsafe(
          `DROP TABLE IF EXISTS "platform";`
        );
        console.log('   ✅ Table dropped');
      } catch (error) {
        if (error.message.includes('violates foreign key constraint')) {
          console.log('   ❌ Cannot drop platform table - foreign key constraints still exist');
          console.log('   Please ensure all references are removed first');
          throw error;
        } else {
          console.log('   ❌ Error dropping table:', error.message);
          throw error;
        }
      }
      console.log('');
    } else {
      console.log('6️⃣ Skipping platform table (does not exist)\n');
    }

    // Step 7: Verification
    console.log('7️⃣ Verifying migration...');
    
    const platformStillExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'platform'
      );
    `;
    
    const superAdminsStillExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'super_admins'
      );
    `;
    
    const platformIdStillExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'company_hqs' 
        AND column_name = 'platformId'
      );
    `;

    console.log('\n📊 Verification Results:');
    console.log(`   Platform table exists: ${platformStillExists[0].exists} (should be false)`);
    console.log(`   Super_admins table exists: ${superAdminsStillExists[0].exists} (should be false)`);
    console.log(`   company_hqs.platformId column exists: ${platformIdStillExists[0].exists} (should be false)`);

    if (!platformStillExists[0].exists && !superAdminsStillExists[0].exists && !platformIdStillExists[0].exists) {
      console.log('\n✅ All models successfully dropped!');
      console.log('\n⚠️  NEXT STEPS:');
      console.log('   1. Verify the schema.prisma file no longer has platform/super_admins models');
      console.log('   2. Run: npx prisma generate');
      console.log('   3. These models are now managed in platform manager repo');
    } else {
      console.log('\n⚠️  Some models still exist - please review and manually drop if needed');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

dropPlatformAndSuperAdmins()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

