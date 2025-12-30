/**
 * Migration: Transform super_admins to Universal Personhood Model
 * 
 * This script:
 * 1. Adds new columns (firebaseId, email, name, firstName, lastName, photoURL)
 * 2. Migrates data from owners table
 * 3. Adds platformId if missing
 * 4. Removes ownerId foreign key and column
 * 
 * Run: node scripts/migrate-super-admins-to-universal-personhood.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateSuperAdmins() {
  try {
    console.log('🚀 Starting super_admins migration to universal personhood model...\n');

    // Step 1: Check current structure
    console.log('1️⃣ Checking current super_admins table structure...');
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'super_admins'
      ORDER BY ordinal_position;
    `;
    console.log('Current columns:', tableInfo.map(c => c.column_name).join(', '));
    console.log('');

    // Step 2: Add new columns if they don't exist
    console.log('2️⃣ Adding new columns (firebaseId, email, name, firstName, lastName, photoURL)...');
    
    const columnsToAdd = [
      { name: 'firebaseId', type: 'TEXT', nullable: true },
      { name: 'email', type: 'TEXT', nullable: true },
      { name: 'name', type: 'TEXT', nullable: true },
      { name: 'firstName', type: 'TEXT', nullable: true },
      { name: 'lastName', type: 'TEXT', nullable: true },
      { name: 'photoURL', type: 'TEXT', nullable: true },
    ];

    for (const col of columnsToAdd) {
      const exists = tableInfo.some(c => c.column_name === col.name);
      if (!exists) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "super_admins" ADD COLUMN "${col.name}" ${col.type}${col.nullable ? '' : ' NOT NULL'};`
        );
        console.log(`   ✅ Added column: ${col.name}`);
      } else {
        console.log(`   ⏭️  Column already exists: ${col.name}`);
      }
    }
    console.log('');

    // Step 3: Check if platformId exists, add if missing
    console.log('3️⃣ Checking platformId column...');
    const platformIdExists = tableInfo.some(c => c.column_name === 'platformId');
    
    if (!platformIdExists) {
      console.log('   Adding platformId column...');
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "super_admins" ADD COLUMN "platformId" TEXT;`
      );
      
      // Check if platform table exists and get default platform ID
      const platform = await prisma.$queryRaw`
        SELECT id FROM platform LIMIT 1;
      `;
      
      if (platform && platform.length > 0) {
        const defaultPlatformId = platform[0].id;
        await prisma.$executeRawUnsafe(
          `UPDATE "super_admins" SET "platformId" = '${defaultPlatformId}' WHERE "platformId" IS NULL;`
        );
        console.log(`   ✅ Backfilled platformId with: ${defaultPlatformId}`);
      } else {
        console.log('   ⚠️  No platform found - you may need to create one first');
      }
    } else {
      console.log('   ✅ platformId column already exists');
    }
    console.log('');

    // Step 4: Migrate data from owners table
    console.log('4️⃣ Migrating data from owners table...');
    const superAdmins = await prisma.$queryRaw`
      SELECT sa.id, sa."ownerId", o."firebaseId", o.email, o.name, o."firstName", o."lastName", o."photoURL"
      FROM "super_admins" sa
      LEFT JOIN owners o ON sa."ownerId" = o.id;
    `;

    if (superAdmins.length === 0) {
      console.log('   ⚠️  No super admins found to migrate');
    } else {
      console.log(`   Found ${superAdmins.length} super admin(s) to migrate`);
      
      for (const admin of superAdmins) {
        const updates = [];
        const values = [];
        
        if (admin.firebaseId && !admin.firebaseId_migrated) {
          updates.push('"firebaseId" = $' + (values.length + 1));
          values.push(admin.firebaseId);
        }
        if (admin.email) {
          updates.push('email = $' + (values.length + 1));
          values.push(admin.email);
        }
        if (admin.name) {
          updates.push('name = $' + (values.length + 1));
          values.push(admin.name);
        }
        if (admin.firstName) {
          updates.push('"firstName" = $' + (values.length + 1));
          values.push(admin.firstName);
        }
        if (admin.lastName) {
          updates.push('"lastName" = $' + (values.length + 1));
          values.push(admin.lastName);
        }
        if (admin.photoURL) {
          updates.push('"photoURL" = $' + (values.length + 1));
          values.push(admin.photoURL);
        }

        if (updates.length > 0) {
          values.push(admin.id);
          await prisma.$executeRawUnsafe(
            `UPDATE "super_admins" SET ${updates.join(', ')} WHERE id = $${values.length}`,
            ...values
          );
          console.log(`   ✅ Migrated data for super admin: ${admin.id}`);
        }
      }
    }
    console.log('');

    // Step 5: Make firebaseId unique and required (if data exists)
    console.log('5️⃣ Setting up firebaseId constraints...');
    const adminsWithFirebaseId = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "super_admins" WHERE "firebaseId" IS NOT NULL;
    `;
    
    if (adminsWithFirebaseId[0].count > 0) {
      // Check for duplicates
      const duplicates = await prisma.$queryRaw`
        SELECT "firebaseId", COUNT(*) as count
        FROM "super_admins"
        WHERE "firebaseId" IS NOT NULL
        GROUP BY "firebaseId"
        HAVING COUNT(*) > 1;
      `;
      
      if (duplicates.length > 0) {
        console.log('   ⚠️  Found duplicate firebaseIds:', duplicates);
        console.log('   ⚠️  Cannot add unique constraint until duplicates are resolved');
      } else {
        // Add unique constraint
        try {
          await prisma.$executeRawUnsafe(
            `CREATE UNIQUE INDEX IF NOT EXISTS "super_admins_firebaseId_key" ON "super_admins"("firebaseId") WHERE "firebaseId" IS NOT NULL;`
          );
          console.log('   ✅ Added unique constraint on firebaseId');
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log('   ✅ Unique constraint already exists on firebaseId');
          } else {
            throw error;
          }
        }
      }
    } else {
      console.log('   ⏭️  No firebaseIds to constrain yet');
    }
    console.log('');

    // Step 6: Add index on firebaseId
    console.log('6️⃣ Adding index on firebaseId...');
    try {
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "super_admins_firebaseId_idx" ON "super_admins"("firebaseId");`
      );
      console.log('   ✅ Index added');
    } catch (error) {
      console.log('   ⚠️  Index may already exist:', error.message);
    }
    console.log('');

    // Step 7: Remove ownerId foreign key constraint
    console.log('7️⃣ Removing ownerId foreign key constraint...');
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "super_admins" DROP CONSTRAINT IF EXISTS "super_admins_ownerId_fkey";`
      );
      console.log('   ✅ Foreign key constraint removed');
    } catch (error) {
      console.log('   ⚠️  Error removing constraint:', error.message);
    }
    console.log('');

    // Step 8: Drop ownerId column (optional - comment out if you want to keep it for reference)
    console.log('8️⃣ Dropping ownerId column...');
    console.log('   ⚠️  SKIPPING - Keeping ownerId for now in case of rollback');
    console.log('   To remove later, run: ALTER TABLE "super_admins" DROP COLUMN IF EXISTS "ownerId";');
    console.log('');

    // Step 9: Verification
    console.log('9️⃣ Verifying migration...');
    const finalStructure = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'super_admins'
      ORDER BY ordinal_position;
    `;
    
    console.log('\n📊 Final super_admins table structure:');
    finalStructure.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    const sampleData = await prisma.$queryRaw`
      SELECT id, "firebaseId", email, "firstName", "lastName", "platformId"
      FROM "super_admins"
      LIMIT 5;
    `;
    
    if (sampleData.length > 0) {
      console.log('\n📋 Sample data:');
      sampleData.forEach(admin => {
        console.log(`   - ${admin.id}: ${admin.firstName} ${admin.lastName} (${admin.email || 'no email'})`);
      });
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n⚠️  NEXT STEPS:');
    console.log('   1. Review the migrated data');
    console.log('   2. If everything looks good, drop ownerId column manually');
    console.log('   3. Run: npx prisma generate in platform manager');
    console.log('   4. Update platform manager code to use new super_admins structure');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateSuperAdmins()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

