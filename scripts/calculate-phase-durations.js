/**
 * One-Time Migration: Calculate phaseTotalDuration for All Phases
 * 
 * This script calculates phaseTotalDuration from totalEstimatedHours for all existing phases.
 * 
 * Usage:
 *   DATABASE_URL="your-database-url" node scripts/calculate-phase-durations.js
 * 
 * Or with .env.local:
 *   node scripts/calculate-phase-durations.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Calculate phaseTotalDuration from totalEstimatedHours
 * Formula: phaseTotalDuration = Math.ceil(totalEstimatedHours / 8)
 */
function calculatePhaseTotalDurationFromHours(totalEstimatedHours) {
  if (!totalEstimatedHours || totalEstimatedHours <= 0) return 0;
  return Math.ceil(totalEstimatedHours / 8);
}

async function calculatePhaseDurations() {
  console.log('🚀 Starting phaseTotalDuration calculation...\n');

  try {
    // Get all phases with their items
    const phases = await prisma.workPackagePhase.findMany({
      include: {
        items: {
          select: {
            quantity: true,
            estimatedHoursEach: true,
          },
        },
      },
      orderBy: {
        workPackageId: 'asc',
        position: 'asc',
      },
    });

    console.log(`Found ${phases.length} phases to process\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const phase of phases) {
      try {
        // Calculate totalEstimatedHours from items
        const calculatedHours = phase.items.reduce((sum, item) => {
          return sum + (item.estimatedHoursEach || 0) * (item.quantity || 0);
        }, 0);

        // Calculate phaseTotalDuration from hours
        const calculatedDuration = calculatePhaseTotalDurationFromHours(calculatedHours);

        // Only update if:
        // 1. We have calculated hours > 0, OR
        // 2. phaseTotalDuration is null/0 and we have hours
        const shouldUpdate = 
          (calculatedHours > 0 && calculatedDuration > 0) ||
          (!phase.phaseTotalDuration && calculatedHours > 0);

        if (shouldUpdate) {
          const updateData = {};

          // Update totalEstimatedHours if different
          if (phase.totalEstimatedHours !== calculatedHours) {
            updateData.totalEstimatedHours = calculatedHours;
          }

          // Update phaseTotalDuration if different or null
          if (phase.phaseTotalDuration !== calculatedDuration) {
            updateData.phaseTotalDuration = calculatedDuration;
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.workPackagePhase.update({
              where: { id: phase.id },
              data: updateData,
            });

            updated++;
            console.log(
              `✅ Phase ${phase.id} (${phase.name}): ` +
              `hours=${calculatedHours}, duration=${calculatedDuration} days`
            );
          } else {
            skipped++;
          }
        } else {
          skipped++;
          console.log(
            `⏭️  Phase ${phase.id} (${phase.name}): ` +
            `Skipped (hours=${calculatedHours}, duration=${phase.phaseTotalDuration || 'null'})`
          );
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error processing phase ${phase.id}:`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📦 Total: ${phases.length}`);

    if (errors === 0) {
      console.log('\n✅ Migration complete!');
    } else {
      console.log('\n⚠️  Migration completed with errors. Review above.');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
calculatePhaseDurations()
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });

