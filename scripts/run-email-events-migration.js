const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Running email_events removal migration...');
    
    const sql = `
      -- Drop foreign key constraint first
      ALTER TABLE "email_events" DROP CONSTRAINT IF EXISTS "email_events_email_activity_id_fkey";

      -- Drop indexes
      DROP INDEX IF EXISTS "email_events_email_activity_id_event_type_idx";
      DROP INDEX IF EXISTS "email_events_email_activity_id_idx";
      DROP INDEX IF EXISTS "email_events_event_type_idx";
      DROP INDEX IF EXISTS "email_events_occurred_at_idx";

      -- Drop the table
      DROP TABLE IF EXISTS "email_events";

      -- Drop the enum (if not used elsewhere)
      DROP TYPE IF EXISTS "EmailEventType";
    `;

    // Execute each statement separately
    await prisma.$executeRawUnsafe(`ALTER TABLE "email_events" DROP CONSTRAINT IF EXISTS "email_events_email_activity_id_fkey";`);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "email_events_email_activity_id_event_type_idx";`);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "email_events_email_activity_id_idx";`);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "email_events_event_type_idx";`);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "email_events_occurred_at_idx";`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "email_events";`);
    await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "EmailEventType";`);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    // Check if table doesn't exist (that's fine)
    if (error.message.includes('does not exist') || error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('ℹ️  Table/enum already removed - migration already applied');
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();

