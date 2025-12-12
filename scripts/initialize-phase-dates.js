/**
 * One-Time Script: Initialize Phase Estimated Dates
 * 
 * This script sets estimatedStartDate and estimatedEndDate for all phases
 * based on WorkPackage effectiveStartDate and phase durations.
 * 
 * Logic:
 * - Phase 1: estimatedStartDate = effectiveStartDate
 * - Phase 1: estimatedEndDate = estimatedStartDate + phaseTotalDuration
 * - Phase 2+: estimatedStartDate = previous phase's estimatedEndDate + 1 day
 * - Phase 2+: estimatedEndDate = estimatedStartDate + phaseTotalDuration
 * 
 * Usage:
 *   DATABASE_URL="your-database-url" node scripts/initialize-phase-dates.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function initializePhaseDates() {
  console.log('🚀 Starting phase date initialization...\n');

  try {
    // Get all work packages with phases
    const workPackages = await prisma.workPackage.findMany({
      include: {
        phases: {
          orderBy: { position: 'asc' },
        },
      },
    });

    console.log(`Found ${workPackages.length} work package(s) to process\n`);

    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const wp of workPackages) {
      if (!wp.effectiveStartDate) {
        console.log(`⏭️  WorkPackage ${wp.id}: No effectiveStartDate, skipping\n`);
        continue;
      }

      if (!wp.phases || wp.phases.length === 0) {
        console.log(`⏭️  WorkPackage ${wp.id}: No phases, skipping\n`);
        continue;
      }

      console.log(`📦 WorkPackage: ${wp.title || 'Untitled'}`);
      console.log(`   Effective Start: ${new Date(wp.effectiveStartDate).toLocaleDateString()}\n`);

      let currentStartDate = new Date(wp.effectiveStartDate);
      let updated = 0;
      let skipped = 0;

      for (const phase of wp.phases) {
        // Skip if phase has no duration
        if (!phase.phaseTotalDuration || phase.phaseTotalDuration <= 0) {
          console.log(`   ⏭️  Phase ${phase.position} (${phase.name}): No duration, skipping`);
          skipped++;
          continue;
        }

        // Determine start date
        let estimatedStartDate = null;
        if (phase.position === 1) {
          // Phase 1 starts on effectiveStartDate
          estimatedStartDate = new Date(wp.effectiveStartDate);
        } else {
          // Phase 2+ starts day after previous phase ends
          estimatedStartDate = new Date(currentStartDate);
        }

        // Calculate end date
        const estimatedEndDate = addDays(estimatedStartDate, phase.phaseTotalDuration);

        // Check if we need to update
        const needsUpdate = 
          !phase.estimatedStartDate ||
          !phase.estimatedEndDate ||
          new Date(phase.estimatedStartDate).getTime() !== estimatedStartDate.getTime() ||
          new Date(phase.estimatedEndDate).getTime() !== estimatedEndDate.getTime();

        if (needsUpdate) {
          await prisma.workPackagePhase.update({
            where: { id: phase.id },
            data: {
              estimatedStartDate,
              estimatedEndDate,
            },
          });

          console.log(
            `   ✅ Phase ${phase.position} (${phase.name}): ` +
            `${estimatedStartDate.toLocaleDateString()} → ${estimatedEndDate.toLocaleDateString()} ` +
            `(${phase.phaseTotalDuration} days)`
          );
          updated++;
        } else {
          console.log(
            `   ✓ Phase ${phase.position} (${phase.name}): ` +
            `Already set (${new Date(phase.estimatedStartDate).toLocaleDateString()} → ${new Date(phase.estimatedEndDate).toLocaleDateString()})`
          );
          skipped++;
        }

        // Move to next phase's start (day after this phase ends)
        currentStartDate = addDays(estimatedEndDate, 1);
      }

      totalUpdated += updated;
      totalSkipped += skipped;
      console.log(`   📊 Updated: ${updated}, Skipped: ${skipped}\n`);
    }

    console.log('📊 Overall Summary:');
    console.log(`   ✅ Updated: ${totalUpdated}`);
    console.log(`   ⏭️  Skipped: ${totalSkipped}`);
    console.log(`   📦 Total Work Packages: ${workPackages.length}`);

    if (totalUpdated > 0) {
      console.log('\n✅ Date initialization complete!');
    } else {
      console.log('\n✅ All phases already have dates set.');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
initializePhaseDates()
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });

