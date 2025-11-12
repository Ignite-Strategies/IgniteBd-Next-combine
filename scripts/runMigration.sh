#!/bin/bash
# Run Prisma migration for app.ignitegrowth.biz
# Usage: DATABASE_URL="your-db-url" ./scripts/runMigration.sh

echo "🚀 Running Prisma migration..."

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  echo "Usage: DATABASE_URL='postgresql://...' ./scripts/runMigration.sh"
  echo "Or set it in .env.local and run: npx prisma migrate dev --name add_client_portal_auth_fields"
  exit 1
fi

export DATABASE_URL
npx prisma migrate dev --name add_client_portal_auth_fields

echo "✅ Migration complete!"
echo "Next: Run 'node scripts/migrateNotesToAuth.js' to backfill data"

