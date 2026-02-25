/**
 * Delete old relationship_contexts lookup rows (144 pre-seeded contextKey rows).
 * Run this before applying the schema that makes relationship_contexts per-contact (contactId required).
 * Usage: node scripts/delete-old-relationship-context-lookups.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Remove old lookup rows (144 contextKey rows). Table may not have contactId yet.
  const result = await prisma.$executeRawUnsafe(`DELETE FROM relationship_contexts`);
  console.log('Deleted old relationship_contexts rows:', result);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
