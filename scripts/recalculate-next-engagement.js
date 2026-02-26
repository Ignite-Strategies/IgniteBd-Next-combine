/**
 * Recalculate nextEngagementDate for contacts.
 * Usage: node scripts/recalculate-next-engagement.js [companyHQId]
 * If companyHQId is omitted, recalculates for all contacts (with crmId set).
 * Run after migration so nextEngagementDate column exists.
 * Alternative: POST /api/outreach/recalculate-next-engagement?companyHQId=xxx (auth required).
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companyHQId = process.argv[2] || null;
  // Dynamic import ESM service
  const { computeAndPersistNextEngagement } = await import('../lib/emailCadenceService.js');

  const where = companyHQId ? { crmId: companyHQId } : { crmId: { not: null } };
  const contacts = await prisma.contact.findMany({
    where: { ...where, doNotContactAgain: false },
    select: { id: true },
  });

  console.log(`Recalculating next engagement for ${contacts.length} contacts${companyHQId ? ` (company ${companyHQId})` : ''}...`);

  let ok = 0;
  let err = 0;
  for (const c of contacts) {
    try {
      const result = await computeAndPersistNextEngagement(c.id);
      if (result.updated) ok++;
    } catch (e) {
      console.warn(`Failed contact ${c.id}:`, e?.message);
      err++;
    }
  }

  console.log(`Done. Updated: ${ok}, errors: ${err}`);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
