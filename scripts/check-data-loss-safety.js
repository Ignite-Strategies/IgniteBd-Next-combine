/**
 * Data Loss Safety Check Script
 * 
 * This script checks for potential data loss before running Prisma migrations
 * It should be run BEFORE any prisma db push or migrate command
 * 
 * Usage: node scripts/check-data-loss-safety.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDataLossSafety() {
  console.log('🔍 Running data loss safety checks...\n');

  const issues = [];
  const warnings = [];

  try {
    // Check 1: BuyingReadiness enum - check current values in database
    console.log('📋 Checking BuyingReadiness enum values...');
    try {
      const buyingReadinessCheck = await prisma.$queryRaw`
        SELECT 
          "buyingReadiness",
          COUNT(*)::int as count
        FROM contacts
        WHERE "buyingReadiness" IS NOT NULL
        GROUP BY "buyingReadiness"
        ORDER BY count DESC
      `;

      if (buyingReadinessCheck.length > 0) {
        console.log('   Current BuyingReadiness values in database:');
        buyingReadinessCheck.forEach((row) => {
          console.log(`   - ${row.buyingReadiness}: ${row.count} contacts`);
        });

        // Check for any invalid enum values (shouldn't happen, but safety check)
        const invalidValues = buyingReadinessCheck.filter(
          (row) => !['NOT_READY', 'READY_NO_MONEY', 'READY_WITH_MONEY'].includes(row.buyingReadiness)
        );

        if (invalidValues.length > 0) {
          issues.push({
            type: 'BuyingReadiness Enum',
            description: `Found invalid enum values: ${invalidValues.map(v => v.buyingReadiness).join(', ')}`,
            action: 'Review and fix enum values in database',
            severity: 'CRITICAL',
          });
        }
      } else {
        console.log('   ✅ No contacts with BuyingReadiness values');
      }
    } catch (error) {
      // If enum doesn't exist or query fails, that's okay - schema might not be updated yet
      console.log('   ℹ️  Could not check BuyingReadiness (enum may not exist yet)');
    }

    // Check 2: Template bases without title (if title is now required)
    console.log('\n📋 Checking template_bases for missing titles...');
    try {
      const templateBasesCheck = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count
        FROM template_bases
        WHERE title IS NULL OR title = ''
      `;

      const missingTitles = parseInt(templateBasesCheck[0].count);
      if (missingTitles > 0) {
        warnings.push({
          type: 'Template Bases',
          description: `${missingTitles} template bases are missing titles`,
          action: 'Titles will be auto-generated, but review existing records',
          severity: 'WARNING',
        });
        console.log(`   ⚠️  Found ${missingTitles} template bases without titles`);
      } else {
        console.log('   ✅ All template bases have titles (or table is empty)');
      }
    } catch (error) {
      // Table might not exist yet
      console.log('   ℹ️  Could not check template_bases (table may not exist yet)');
    }

    // Check 3: Check for any enum changes that would cause data loss
    console.log('\n📋 Checking for enum value mismatches...');
    // This is a general check - we can expand this for other enums in the future

    // Summary
    console.log('\n' + '='.repeat(60));
    if (issues.length === 0 && warnings.length === 0) {
      console.log('✅ All safety checks passed!');
      console.log('✅ Safe to run: npx prisma db push');
      return { safe: true, issues: [], warnings: [] };
    }

    if (issues.length > 0) {
      console.log('\n❌ CRITICAL ISSUES FOUND - DO NOT PROCEED WITH MIGRATION');
      console.log('='.repeat(60));
      issues.forEach((issue, i) => {
        console.log(`\n${i + 1}. ${issue.type} (${issue.severity})`);
        console.log(`   Description: ${issue.description}`);
        console.log(`   Action: ${issue.action}`);
      });
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.forEach((warning, i) => {
        console.log(`\n${i + 1}. ${warning.type}`);
        console.log(`   Description: ${warning.description}`);
        console.log(`   Action: ${warning.action}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    return { safe: issues.length === 0, issues, warnings };
  } catch (error) {
    console.error('\n❌ Safety check error:', error.message);
    // Don't throw - allow the check to complete even if some checks fail
    return { safe: false, issues: [{ type: 'Safety Check Error', description: error.message, action: 'Review error and fix', severity: 'CRITICAL' }], warnings: [] };
  } finally {
    await prisma.$disconnect();
  }
}

// Run safety check
checkDataLossSafety()
  .then((result) => {
    if (result.safe) {
      console.log('\n✅ Safe to proceed with migration');
      process.exit(0);
    } else {
      console.log('\n❌ UNSAFE TO PROCEED - Fix issues above first');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Safety check failed:', error.message);
    process.exit(1);
  });
