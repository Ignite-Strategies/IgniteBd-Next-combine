#!/bin/bash

# Safe Prisma Push Wrapper
# This script runs safety checks before allowing prisma db push
# Usage: ./scripts/safe-prisma-push.sh [--accept-data-loss]

set -e  # Exit on error

echo "🔒 Safe Prisma Push"
echo "==================="
echo ""

# Step 1: Run safety checks
echo "Step 1: Running data loss safety checks..."
node scripts/check-data-loss-safety.js

SAFETY_CHECK_EXIT=$?

if [ $SAFETY_CHECK_EXIT -ne 0 ]; then
  echo ""
  echo "❌ SAFETY CHECK FAILED"
  echo "❌ Migration blocked to prevent data loss"
  echo ""
  echo "Please fix the issues above before proceeding."
  echo "If you need to migrate data, run the appropriate migration script first."
  exit 1
fi

echo ""
echo "✅ Safety checks passed"
echo ""

# Step 2: Check if --accept-data-loss flag is provided
if [[ "$*" == *"--accept-data-loss"* ]]; then
  echo "⚠️  WARNING: --accept-data-loss flag detected"
  echo "⚠️  This will bypass Prisma's data loss warnings"
  echo ""
  read -p "Are you absolutely sure you want to proceed? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "❌ Migration cancelled by user"
    exit 1
  fi
fi

# Step 3: Run prisma db push
echo "Step 2: Running prisma db push..."
npx prisma db push "$@"

PUSH_EXIT=$?

if [ $PUSH_EXIT -ne 0 ]; then
  echo ""
  echo "❌ Prisma db push failed"
  exit 1
fi

echo ""
echo "✅ Migration completed successfully"
echo "✅ Database schema is now in sync"
