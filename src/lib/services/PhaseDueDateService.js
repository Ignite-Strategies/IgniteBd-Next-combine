import { prisma } from '@/lib/prisma';
import { computeExpectedEndDate } from '@/lib/utils/workPackageTimeline';

/**
 * Phase Due Date Service
 * Calculates and manages estimated due dates for phases based on effective dates
 * 
 * Logic:
 * - Phase effectiveDate = WorkPackage effectiveStartDate + cumulative days from previous phases
 * - Phase expectedEndDate = effectiveDate + (totalEstimatedHours / 8 days)
 * - Timeline status = compare today vs expectedEndDate
 */

/**
 * Calculate effective date for a phase based on WorkPackage start and previous phases
 * Uses actual dates when available for progressive calculation
 * 
 * @param {Date|string|null} workPackageStartDate - WorkPackage effectiveStartDate
 * @param {Array} allPhases - All phases sorted by position (should include actualStartDate/actualEndDate)
 * @param {number} currentPhasePosition - Position of current phase
 * @returns {Date|null} - Effective start date for the phase
 */
export function calculatePhaseEffectiveDate(workPackageStartDate, allPhases, currentPhasePosition) {
  if (!workPackageStartDate) return null;

  const startDate = new Date(workPackageStartDate);
  let currentDate = new Date(startDate);

  // Sort phases by position
  const sortedPhases = [...allPhases].sort((a, b) => a.position - b.position);

  // Find all phases before current phase
  const previousPhases = sortedPhases.filter((p) => p.position < currentPhasePosition);

  // Calculate cumulative days from previous phases
  // Use actual dates when available for progressive calculation
  previousPhases.forEach((phase) => {
    // If phase has actualEndDate (completed), use it for progressive calculation
    if (phase.actualEndDate) {
      currentDate = new Date(phase.actualEndDate);
      currentDate.setDate(currentDate.getDate() + 1); // Next phase starts day after
    } 
    // If phase has actualStartDate (in progress), calculate from actual start
    else if (phase.actualStartDate && phase.phaseTotalDuration) {
      const actualStart = new Date(phase.actualStartDate);
      const days = phase.phaseTotalDuration || Math.ceil((phase.totalEstimatedHours || 0) / 8);
      currentDate = new Date(actualStart);
      currentDate.setDate(currentDate.getDate() + days);
      currentDate.setDate(currentDate.getDate() + 1); // Next phase starts day after
    }
    // Otherwise, use estimated duration
    else {
      const days = phase.phaseTotalDuration || Math.ceil((phase.totalEstimatedHours || 0) / 8);
      currentDate.setDate(currentDate.getDate() + days);
    }
  });

  return currentDate;
}

/**
 * Calculate expected end date (due date) for a phase
 * @param {Date|string|null} effectiveDate - Phase effective start date
 * @param {number} totalEstimatedHours - Total estimated hours for the phase
 * @returns {Date|null} - Expected end date, or null if inputs are invalid
 */
export function calculatePhaseDueDate(effectiveDate, totalEstimatedHours) {
  return computeExpectedEndDate(effectiveDate, totalEstimatedHours);
}

/**
 * Recalculate and update all phase dates for a work package
 * This should be called when:
 * - WorkPackage effectiveStartDate changes
 * - Phase order/position changes
 * - Phase totalEstimatedHours changes
 * 
 * @param {string} workPackageId - WorkPackage ID
 * @param {boolean} overwriteActuals - If true, will overwrite actual dates (default: false)
 * @returns {Promise<Array>} - Array of updated phases with calculated dates
 */
export async function recalculateAllPhaseDates(workPackageId, overwriteActuals = false) {
  if (!workPackageId) {
    throw new Error('WorkPackage ID is required');
  }

  // Get work package with effectiveStartDate
  const workPackage = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    select: {
      effectiveStartDate: true,
    },
  });

  if (!workPackage) {
    throw new Error(`WorkPackage not found: ${workPackageId}`);
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

  // Calculate dates for each phase sequentially
  // Use actual dates when available for progressive calculation
  const updatedPhases = [];
  let currentStartDate = workPackage.effectiveStartDate 
    ? new Date(workPackage.effectiveStartDate) 
    : null;

  for (const phase of phases) {
    // Calculate totalEstimatedHours from items
    const totalEstimatedHours = phase.items.reduce((sum, item) => {
      return sum + (item.estimatedHoursEach || 0) * (item.quantity || 0);
    }, 0);

    // Calculate phaseTotalDuration (business days)
    const phaseTotalDuration = totalEstimatedHours > 0 
      ? Math.ceil(totalEstimatedHours / 8) 
      : 0;

    // Determine start date for this phase:
    // 1. If actualStartDate exists, use it (phase already started)
    // 2. Otherwise, use calculated estimatedStartDate
    const phaseStartDate = phase.actualStartDate 
      ? new Date(phase.actualStartDate)
      : currentStartDate;

    // Calculate estimatedEndDate if we have a start date
    let estimatedEndDate = null;
    if (phaseStartDate && totalEstimatedHours > 0) {
      estimatedEndDate = calculatePhaseDueDate(phaseStartDate, totalEstimatedHours);
    }

    // Build update data
    const updateData = {
      totalEstimatedHours,
      phaseTotalDuration,
      estimatedStartDate: currentStartDate, // Always store the calculated estimated start
      estimatedEndDate,
    };

    // Only overwrite actual dates if explicitly requested
    if (overwriteActuals) {
      // If phase is in_progress and no actualStartDate, set it
      if (phase.status === 'in_progress' && !phase.actualStartDate) {
        updateData.actualStartDate = new Date();
      }
      // If phase is completed and no actualEndDate, set it
      if (phase.status === 'completed' && !phase.actualEndDate) {
        updateData.actualEndDate = new Date();
      }
    }

    // Update the phase
    const updatedPhase = await prisma.workPackagePhase.update({
      where: { id: phase.id },
      data: updateData,
    });

    updatedPhases.push(updatedPhase);

    // Move to next phase's start date:
    // Use actualEndDate if phase is completed, otherwise use estimatedEndDate
    // This ensures progressive calculation is based on actual progress
    const phaseEndDate = phase.actualEndDate 
      ? new Date(phase.actualEndDate)
      : (estimatedEndDate ? new Date(estimatedEndDate) : null);

    if (phaseEndDate) {
      currentStartDate = new Date(phaseEndDate);
      currentStartDate.setDate(currentStartDate.getDate() + 1);
    } else if (estimatedEndDate) {
      // Fallback to estimated if no actual end date
      currentStartDate = new Date(estimatedEndDate);
      currentStartDate.setDate(currentStartDate.getDate() + 1);
    }
  }

  return updatedPhases;
}

/**
 * Upsert WorkPackage effectiveStartDate
 * This will trigger recalculation of all phase dates
 * 
 * @param {string} workPackageId - WorkPackage ID
 * @param {Date|string} effectiveStartDate - New effective start date
 * @param {boolean} overwriteActuals - If true, will overwrite actual dates (default: false)
 * @returns {Promise<Object>} - Updated work package
 */
export async function upsertWorkPackageEffectiveDate(workPackageId, effectiveStartDate, overwriteActuals = false) {
  if (!workPackageId) {
    throw new Error('WorkPackage ID is required');
  }

  if (!effectiveStartDate) {
    throw new Error('Effective start date is required');
  }

  const date = new Date(effectiveStartDate);

  // Update work package
  const updatedWorkPackage = await prisma.workPackage.update({
    where: { id: workPackageId },
    data: {
      effectiveStartDate: date,
    },
  });

  // Recalculate all phase dates (estimated dates will be updated)
  await recalculateAllPhaseDates(workPackageId, overwriteActuals);

  return updatedWorkPackage;
}

/**
 * Overwrite phase dates (manual override capability)
 * Allows manual setting of estimated or actual dates
 * 
 * @param {string} phaseId - WorkPackagePhase ID
 * @param {Object} dates - Dates to overwrite
 * @param {Date|string|null} dates.estimatedStartDate - Overwrite estimated start date
 * @param {Date|string|null} dates.estimatedEndDate - Overwrite estimated end date
 * @param {Date|string|null} dates.actualStartDate - Overwrite actual start date
 * @param {Date|string|null} dates.actualEndDate - Overwrite actual end date
 * @returns {Promise<Object>} - Updated phase
 */
export async function overwritePhaseDates(phaseId, dates) {
  if (!phaseId) {
    throw new Error('Phase ID is required');
  }

  const updateData = {};

  if (dates.estimatedStartDate !== undefined) {
    updateData.estimatedStartDate = dates.estimatedStartDate ? new Date(dates.estimatedStartDate) : null;
  }

  if (dates.estimatedEndDate !== undefined) {
    updateData.estimatedEndDate = dates.estimatedEndDate ? new Date(dates.estimatedEndDate) : null;
  }

  if (dates.actualStartDate !== undefined) {
    updateData.actualStartDate = dates.actualStartDate ? new Date(dates.actualStartDate) : null;
  }

  if (dates.actualEndDate !== undefined) {
    updateData.actualEndDate = dates.actualEndDate ? new Date(dates.actualEndDate) : null;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('At least one date field must be provided');
  }

  const updatedPhase = await prisma.workPackagePhase.update({
    where: { id: phaseId },
    data: updateData,
  });

  return updatedPhase;
}

/**
 * Set actual dates based on phase status changes
 * Called automatically when phase status changes
 * 
 * @param {string} phaseId - WorkPackagePhase ID
 * @param {string} newStatus - New phase status (not_started | in_progress | completed)
 * @returns {Promise<Object>} - Updated phase
 */
export async function updatePhaseDatesFromStatus(phaseId, newStatus) {
  if (!phaseId) {
    throw new Error('Phase ID is required');
  }

  const phase = await prisma.workPackagePhase.findUnique({
    where: { id: phaseId },
    select: {
      actualStartDate: true,
      actualEndDate: true,
    },
  });

  if (!phase) {
    throw new Error(`Phase not found: ${phaseId}`);
  }

  const updateData = {
    status: newStatus,
  };

  // Set actualStartDate when status changes to in_progress (if not already set)
  if (newStatus === 'in_progress' && !phase.actualStartDate) {
    updateData.actualStartDate = new Date();
  }

  // Set actualEndDate when status changes to completed (if not already set)
  if (newStatus === 'completed' && !phase.actualEndDate) {
    updateData.actualEndDate = new Date();
  }

  const updatedPhase = await prisma.workPackagePhase.update({
    where: { id: phaseId },
    data: updateData,
  });

  return updatedPhase;
}

