#!/bin/bash

# Database Rebuild Script
# Run after creating new database

set -e  # Exit on error

echo "🔧 IgniteBd Database Rebuild Script"
echo "======================================"
echo ""

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set!"
  echo ""
  echo "Set it in .env.local or export it:"
  echo "  export DATABASE_URL='postgresql://user:pass@host:5432/dbname'"
  exit 1
fi

echo "✅ DATABASE_URL found"
echo ""

# Generate Prisma Client
echo "📦 Step 1: Generating Prisma Client..."
npx prisma generate
echo "✅ Prisma Client generated"
echo ""

# Run migrations
echo "🚀 Step 2: Running all migrations..."
npx prisma migrate deploy
echo "✅ Migrations applied"
echo ""

# Check status
echo "📊 Step 3: Checking migration status..."
npx prisma migrate status
echo ""

# Verify connection
echo "🔍 Step 4: Verifying database connection..."
npx prisma db execute --stdin <<< "SELECT COUNT(*) as migration_count FROM _prisma_migrations;" || {
  echo "❌ Database connection failed!"
  exit 1
}
echo "✅ Database connection verified"
echo ""

echo "✅ Database rebuild complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Create your Owner record:"
echo "   - Visit /api/debug/fix-owner (POST) while logged in"
echo "   - Or use: node scripts/create-owner.js"
echo ""
echo "2. Verify Owner:"
echo "   - Visit /api/debug/owner-check (GET)"
echo ""
echo "3. Test billing:"
echo "   - Visit /api/admin/billing (GET)"
echo ""

