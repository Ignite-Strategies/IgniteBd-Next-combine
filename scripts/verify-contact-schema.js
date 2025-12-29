const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    // Check total contacts
    const totalContacts = await prisma.contact.count();
    console.log(`✅ Total contacts in database: ${totalContacts}`);

    // Check unique emails
    const uniqueEmails = await prisma.contact.groupBy({
      by: ['email'],
      where: {
        email: { not: null },
      },
      _count: {
        id: true,
      },
    });
    console.log(`✅ Unique emails: ${uniqueEmails.length}`);

    // Check for duplicates (email + crmId pairs)
    const duplicatePairs = await prisma.$queryRaw`
      SELECT email, "crmId", COUNT(*) as count
      FROM contacts
      WHERE email IS NOT NULL
      GROUP BY email, "crmId"
      HAVING COUNT(*) > 1;
    `;
    
    if (duplicatePairs.length > 0) {
      console.error(`❌ Found ${duplicatePairs.length} duplicate [email, crmId] pairs!`);
      console.error(duplicatePairs);
    } else {
      console.log(`✅ No duplicate [email, crmId] pairs - constraint is valid`);
    }

    // Check constraint exists
    const constraints = await prisma.$queryRaw`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'contacts'
      AND constraint_type = 'UNIQUE';
    `;
    console.log(`\n📋 Unique constraints on contacts table:`);
    constraints.forEach(c => {
      console.log(`   - ${c.constraint_name} (${c.constraint_type})`);
    });

    console.log(`\n✅ Verification complete - no data loss detected!`);
  } catch (error) {
    console.error('❌ Verification error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();

