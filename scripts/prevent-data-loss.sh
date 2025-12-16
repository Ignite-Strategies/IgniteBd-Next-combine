#!/bin/bash

# Prevent Data Loss Safety Script
# This script MUST be run before any prisma db push or migrate command
# It checks for potential data loss and prevents unsafe migrations

set -e  # Exit on error

echo "🔒 Data Loss Prevention Check"
echo "=============================="
echo ""

# Check if safety check script exists
if [ ! -f "scripts/check-data-loss-safety.js" ]; then
  echo "❌ Safety check script not found!"
  exit 1
fi

# Run safety check
echo "Running safety checks..."
node scripts/check-data-loss-safety.js

SAFETY_CHECK_EXIT=$?

if [ $SAFETY_CHECK_EXIT -ne 0 ]; then
  echo ""
  echo "❌ SAFETY CHECK FAILED"
  echo "❌ DO NOT PROCEED WITH MIGRATION"
  echo ""
  echo "Fix the issues above before running prisma db push"
  exit 1
fi

echo ""
echo "✅ Safety checks passed"
echo "✅ Safe to proceed with: npx prisma db push"
echo ""
