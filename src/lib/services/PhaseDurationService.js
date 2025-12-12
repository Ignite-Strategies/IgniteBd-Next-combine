import { prisma } from '@/lib/prisma';
import { convertHoursToDays } from '@/lib/utils/workPackageTimeline';

/**
 * Phase Duration Service
 * Calculates and upserts phaseTotalDuration from totalEstimatedHours
 * 
 * Logic:
 * - phaseTotalDuration = totalEstimatedHours / 8 (business days)
 * - 8 hours = 1 business day
 */

/**
 * Calculate phaseTotalDuration from totalEstimatedHours
 * Formula: phaseTotalDuration = totalEstimatedHours / 8 (business days)
 * Unit of measure: days (8 hours = 1 business day)
 * 
 * @param {number} totalEstimatedHours - Total estimated hours for the phase
 * @returns {number} - Phase total duration in business days (rounded up)
 */
export function calculatePhaseTotalDurationFromHours(totalEstimatedHours) {
  if (!totalEstimatedHours || totalEstimatedHours <= 0) return 0;
  // Convert hours to days: 8 hours = 1 business day
  return Math.ceil(totalEstimatedHours / 8);
}

/**
 * Upsert phase with calculated phaseTotalDuration
 * Updates the phaseTotalDuration field based on totalEstimatedHours
 * 
 * @param {string} phaseId - WorkPackagePhase ID
 * @param {number} totalEstimatedHours - Total estimated hours (if not provided, will calculate from items)
 * @returns {Promise<Object>} - Updated phase
 */
export async function upsertPhaseTotalDuration(phaseId, totalEstimatedHours = null) {
  if (!phaseId) {
    throw new Error('Phase ID is required');
  }

  // Get the phase with items to calculate totalEstimatedHours if not provided
  let calculatedHours = totalEstimatedHours;
  
  if (calculatedHours === null) {
    const phase = await prisma.workPackagePhase.findUnique({
      where: { id: phaseId },
      include: {
        items: {
          select: {
            quantity: true,
            estimatedHoursEach: true,
          },
        },
      },
    });

    if (!phase) {
      throw new Error(`Phase not found: ${phaseId}`);
    }

    // Calculate totalEstimatedHours from items
    calculatedHours = phase.items.reduce((sum, item) => {
      return sum + (item.estimatedHoursEach || 0) * (item.quantity || 0);
    }, 0);

    // Also update totalEstimatedHours if it's different
    if (phase.totalEstimatedHours !== calculatedHours) {
      await prisma.workPackagePhase.update({
        where: { id: phaseId },
        data: { totalEstimatedHours: calculatedHours },
      });
    }
  }

  // Calculate phaseTotalDuration from hours
  const phaseTotalDuration = calculatePhaseTotalDurationFromHours(calculatedHours);

  // Upsert the phase with calculated duration
  const updatedPhase = await prisma.workPackagePhase.update({
    where: { id: phaseId },
    data: {
      phaseTotalDuration,
      totalEstimatedHours: calculatedHours,
    },
  });

  return updatedPhase;
}

/**
 * Recalculate and upsert phaseTotalDuration for all phases in a work package
 * Useful when items are added/updated/removed
 * 
 * @param {string} workPackageId - WorkPackage ID
 * @returns {Promise<Array>} - Array of updated phases
 */
export async function recalculateAllPhaseDurations(workPackageId) {
  if (!workPackageId) {
    throw new Error('WorkPackage ID is required');
  }

  // Get all phases with their items
  const phases = await prisma.workPackagePhase.findMany({
    where: { workPackageId },
    include: {
      items: {
        select: {
          quantity: true,
          estimatedHoursEach: true,
        },
      },
    },
    orderBy: { position: 'asc' },
  });

  // Update each phase
  const updatedPhases = await Promise.all(
    phases.map(async (phase) => {
      // Calculate totalEstimatedHours from items
      const totalEstimatedHours = phase.items.reduce((sum, item) => {
        return sum + (item.estimatedHoursEach || 0) * (item.quantity || 0);
      }, 0);

      // Calculate phaseTotalDuration
      const phaseTotalDuration = calculatePhaseTotalDurationFromHours(totalEstimatedHours);

      // Update the phase
      return await prisma.workPackagePhase.update({
        where: { id: phase.id },
        data: {
          totalEstimatedHours,
          phaseTotalDuration,
        },
      });
    })
  );

  return updatedPhases;
}

