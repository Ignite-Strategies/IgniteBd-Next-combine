#!/bin/bash

# Resolve All Failed Migrations
# 
# This script finds all failed migrations and marks them as applied using
# Prisma's built-in resolve command.
#
# Usage:
#   ./scripts/resolve-all-failed-migrations.sh
#   Or: DATABASE_URL="postgresql://..." ./scripts/resolve-all-failed-migrations.sh

set -e

echo "🔍 Finding failed migrations..."

# Get all failed migrations from the database
FAILED_MIGRATIONS=$(psql "$DATABASE_URL" -t -c "
  SELECT migration_name 
  FROM _prisma_migrations 
  WHERE finished_at IS NULL 
     OR rolled_back_at IS NOT NULL
  ORDER BY started_at ASC;
" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$')

if [ -z "$FAILED_MIGRATIONS" ]; then
  echo "✅ No failed migrations found!"
  exit 0
fi

# Count migrations
MIGRATION_COUNT=$(echo "$FAILED_MIGRATIONS" | wc -l | tr -d ' ')
echo "Found $MIGRATION_COUNT failed migration(s):"
echo "$FAILED_MIGRATIONS" | nl
echo ""

echo "⚠️  Marking all failed migrations as applied..."
echo ""

SUCCESS=0
FAILED=0

# Mark each migration as applied
while IFS= read -r migration_name; do
  if [ -z "$migration_name" ]; then
    continue
  fi
  
  echo "🔄 Resolving: $migration_name"
  
  if npx prisma migrate resolve --applied "$migration_name" 2>/dev/null; then
    echo "✅ Marked as applied: $migration_name"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "❌ Failed to resolve: $migration_name"
    FAILED=$((FAILED + 1))
  fi
  echo ""
done <<< "$FAILED_MIGRATIONS"

echo "============================================================"
echo "📊 Summary:"
echo "✅ Successfully resolved: $SUCCESS"
echo "❌ Failed: $FAILED"
echo "============================================================"
echo ""

if [ $SUCCESS -gt 0 ]; then
  echo "✅ All failed migrations have been marked as applied!"
  echo ""
  echo "Next steps:"
  echo "1. Run: npx prisma migrate deploy"
  echo "2. This should now proceed without migration conflicts"
  echo "3. Verify your schema is in sync with: npx prisma migrate status"
  echo ""
fi

if [ $FAILED -gt 0 ]; then
  exit 1
fi






