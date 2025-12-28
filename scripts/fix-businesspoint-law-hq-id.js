/**
 * Fix BusinessPoint Law CompanyHQ ID
 * 
 * Migrates from readable string ID ('businesspoint-law-hq') to proper UUID
 * 
 * Run: node scripts/fix-businesspoint-law-hq-id.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

async function fixBusinessPointLawHQId() {
  try {
    console.log('🔧 Fixing BusinessPoint Law CompanyHQ ID...\n');

    // Find the CompanyHQ with the readable ID
    const oldHQ = await prisma.company_hqs.findUnique({
      where: { id: 'businesspoint-law-hq' },
      include: {
        company_memberships: {
          include: {
            owners: true
          }
        },
        contacts_contacts_crmIdTocompany_hqs: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    if (!oldHQ) {
      console.log('❌ BusinessPoint Law CompanyHQ with ID "businesspoint-law-hq" not found');
      console.log('   It may have already been migrated or doesn\'t exist.');
      process.exit(1);
    }

    console.log(`📋 Found CompanyHQ:`);
    console.log(`   Old ID: ${oldHQ.id}`);
    console.log(`   Name: ${oldHQ.companyName}`);
    console.log(`   Memberships: ${oldHQ.company_memberships.length}`);
    console.log(`   Contacts: ${oldHQ.contacts_contacts_crmIdTocompany_hqs.length}`);

    // Generate new UUID
    const newId = randomUUID();
    console.log(`\n🔄 Migrating to new UUID: ${newId}`);

    // Update CompanyHQ ID (this is tricky - Prisma doesn't allow updating primary key directly)
    // We need to create new and delete old, or use raw SQL

    // Step 1: Create new CompanyHQ with UUID
    console.log('\n1️⃣ Creating new CompanyHQ with UUID...');
    const newHQ = await prisma.company_hqs.create({
      data: {
        id: newId,
        companyName: oldHQ.companyName,
        companyStreet: oldHQ.companyStreet,
        companyCity: oldHQ.companyCity,
        companyState: oldHQ.companyState,
        companyWebsite: oldHQ.companyWebsite,
        whatYouDo: oldHQ.whatYouDo,
        companyIndustry: oldHQ.companyIndustry,
        teamSize: oldHQ.teamSize,
        ownerId: oldHQ.ownerId,
        contactOwnerId: oldHQ.contactOwnerId,
        managerId: oldHQ.managerId,
        companyAnnualRev: oldHQ.companyAnnualRev,
        yearsInBusiness: oldHQ.yearsInBusiness,
        platformId: oldHQ.platformId,
        tier: oldHQ.tier,
        createdAt: oldHQ.createdAt,
        updatedAt: new Date(),
      }
    });
    console.log(`   ✅ Created: ${newHQ.id}`);

    // Step 2: Update all contacts to use new crmId
    console.log('\n2️⃣ Updating contacts...');
    const contactsUpdate = await prisma.contact.updateMany({
      where: { crmId: 'businesspoint-law-hq' },
      data: { crmId: newId }
    });
    console.log(`   ✅ Updated ${contactsUpdate.count} contacts`);

    // Step 3: Update all memberships
    console.log('\n3️⃣ Updating memberships...');
    for (const membership of oldHQ.company_memberships) {
      await prisma.company_memberships.update({
        where: { id: membership.id },
        data: { companyHqId: newId }
      });
    }
    console.log(`   ✅ Updated ${oldHQ.company_memberships.length} memberships`);

    // Step 4: Update other relations (companies, contact_lists, etc.)
    console.log('\n4️⃣ Updating related records...');
    
    // Companies
    const companiesUpdate = await prisma.$executeRaw`
      UPDATE companies 
      SET "companyHQId" = ${newId}
      WHERE "companyHQId" = 'businesspoint-law-hq'
    `;
    console.log(`   ✅ Updated ${companiesUpdate || 0} companies`);

    // Contact Lists
    const contactListsUpdate = await prisma.$executeRaw`
      UPDATE contact_lists 
      SET "companyId" = ${newId}
      WHERE "companyId" = 'businesspoint-law-hq'
    `;
    console.log(`   ✅ Updated ${contactListsUpdate || 0} contact lists`);

    // Step 5: Delete old CompanyHQ
    console.log('\n5️⃣ Deleting old CompanyHQ...');
    await prisma.company_hqs.delete({
      where: { id: 'businesspoint-law-hq' }
    });
    console.log('   ✅ Deleted old CompanyHQ');

    // Step 6: Verification
    console.log('\n6️⃣ Verifying migration...');
    const verifyHQ = await prisma.company_hqs.findUnique({
      where: { id: newId },
      include: {
        company_memberships: true,
        contacts_contacts_crmIdTocompany_hqs: true
      }
    });

    if (verifyHQ) {
      console.log(`   ✅ Verification successful:`);
      console.log(`      ID: ${verifyHQ.id}`);
      console.log(`      Name: ${verifyHQ.companyName}`);
      console.log(`      Memberships: ${verifyHQ.company_memberships.length}`);
      console.log(`      Contacts: ${verifyHQ.contacts_contacts_crmIdTocompany_hqs.length}`);
    } else {
      console.log('   ❌ Verification failed - new CompanyHQ not found');
      process.exit(1);
    }

    // Check for any remaining references
    const remainingContacts = await prisma.contact.count({
      where: { crmId: 'businesspoint-law-hq' }
    });

    if (remainingContacts > 0) {
      console.log(`\n⚠️  Warning: ${remainingContacts} contacts still have old crmId`);
    }

    console.log('\n🎉 Migration completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   Old ID: businesspoint-law-hq`);
    console.log(`   New ID: ${newId}`);
    console.log(`\n⚠️  IMPORTANT: Update seed script to use UUID for future runs!`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixBusinessPointLawHQId();

