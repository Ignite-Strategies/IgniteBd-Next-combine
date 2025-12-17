import { prisma } from '@/lib/prisma';

/**
 * Phase Due Date Service
 * Manages phase scheduling with pure date arithmetic (no hours conversion)
 * 
 * Core Principles:
 * - Database is source of truth (estimatedStartDate, estimatedEndDate)
 * - When Phase N moves, shift Phase N+1, N+2, etc. by same delta
 * - Actual dates are independent checkpoints
 * - No hours-to-days conversion in date calculations
 */

/**
 * Calculate duration in days from two dates
 * Pure date arithmetic - no business day logic
 * 
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {number} - Duration in days
 */
export function calculateDurationFromDates(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end - start;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Shift all phases after the given phase by deltaDays
 * Pure date arithmetic - no hours conversion, no business-day logic
 * 
 * @param {string} phaseId - Phase ID that was moved
 * @param {number} deltaDays - Number of days to shift (can be negative)
 * @returns {Promise<Array>} - Array of updated phases
 */
export async function shiftSubsequentPhases(phaseId, deltaDays) {
  if (!phaseId || deltaDays === 0) {
    return [];
  }

  // Get current phase to find position
  const currentPhase = await prisma.workPackagePhase.findUnique({
    where: { id: phaseId },
    select: { position: true, workPackageId: true },
  });

  if (!currentPhase) {
    throw new Error(`Phase not found: ${phaseId}`);
  }

  // Get all subsequent phases
  const subsequentPhases = await prisma.workPackagePhase.findMany({
    where: {
      workPackageId: currentPhase.workPackageId,
      position: { gt: currentPhase.position },
    },
    orderBy: { position: 'asc' },
  });

  if (subsequentPhases.length === 0) {
    return [];
  }

  // Shift each phase by delta
  const updatedPhases = await Promise.all(
    subsequentPhases.map(async (phase) => {
      const updates = {};

      if (phase.estimatedStartDate) {
        const newStart = new Date(phase.estimatedStartDate);
        newStart.setDate(newStart.getDate() + deltaDays);
        updates.estimatedStartDate = newStart;
      }

      if (phase.estimatedEndDate) {
        const newEnd = new Date(phase.estimatedEndDate);
        newEnd.setDate(newEnd.getDate() + deltaDays);
        updates.estimatedEndDate = newEnd;
      }

      if (Object.keys(updates).length > 0) {
        return await prisma.workPackagePhase.update({
          where: { id: phase.id },
          data: updates,
        });
      }

      return phase;
    })
  );

  return updatedPhases.filter(Boolean);
}

/**
 * Update phase dates and/or duration
 * Handles all editing paths and shifts subsequent phases
 * 
 * @param {string} phaseId - Phase ID
 * @param {Object} updates - Update data
 * @param {Date|string|null} updates.estimatedStartDate - New start date
 * @param {Date|string|null} updates.estimatedEndDate - New end date
 * @param {number|null} updates.phaseTotalDuration - New duration (days)
 * @returns {Promise<Object>} - Updated phase
 */
export async function updatePhaseDates(phaseId, updates) {
  if (!phaseId) {
    throw new Error('Phase ID is required');
  }

  // Get current phase to calculate deltas
  const currentPhase = await prisma.workPackagePhase.findUnique({
    where: { id: phaseId },
    select: {
      estimatedStartDate: true,
      estimatedEndDate: true,
      phaseTotalDuration: true,
    },
  });

  if (!currentPhase) {
    throw new Error(`Phase not found: ${phaseId}`);
  }

  const updateData = {};
  let deltaDays = 0;

  // Path 1: User edited duration
  if (updates.phaseTotalDuration !== undefined && updates.phaseTotalDuration !== null) {
    const newDuration = typeof updates.phaseTotalDuration === 'string' 
      ? parseInt(updates.phaseTotalDuration, 10) 
      : updates.phaseTotalDuration;
    
    if (isNaN(newDuration) || newDuration < 0) {
      throw new Error('phaseTotalDuration must be a valid positive number');
    }
    
    updateData.phaseTotalDuration = newDuration;

    // If we have a start date, calculate new end date
    if (currentPhase.estimatedStartDate) {
      const startDate = new Date(currentPhase.estimatedStartDate);
      const newEndDate = new Date(startDate);
      newEndDate.setDate(newEndDate.getDate() + newDuration);
      updateData.estimatedEndDate = newEndDate;

      // Calculate delta from old end date
      if (currentPhase.estimatedEndDate) {
        const oldEnd = new Date(currentPhase.estimatedEndDate);
        deltaDays = Math.floor((newEndDate - oldEnd) / (1000 * 60 * 60 * 24));
      } else {
        // No old end date, so delta is just the duration
        deltaDays = newDuration;
      }
    }
  }
  // Path 2: User edited end date
  else if (updates.estimatedEndDate !== undefined) {
    const newEndDate = updates.estimatedEndDate ? new Date(updates.estimatedEndDate) : null;
    updateData.estimatedEndDate = newEndDate;

    // Recalculate duration from dates
    if (newEndDate && currentPhase.estimatedStartDate) {
      const duration = calculateDurationFromDates(currentPhase.estimatedStartDate, newEndDate);
      updateData.phaseTotalDuration = duration;
    }

    // Calculate delta from old end date
    if (currentPhase.estimatedEndDate && newEndDate) {
      const oldEnd = new Date(currentPhase.estimatedEndDate);
      deltaDays = Math.floor((newEndDate - oldEnd) / (1000 * 60 * 60 * 24));
    } else if (newEndDate && !currentPhase.estimatedEndDate) {
      // No old end date, calculate from start
      if (currentPhase.estimatedStartDate) {
        const duration = calculateDurationFromDates(currentPhase.estimatedStartDate, newEndDate);
        deltaDays = duration;
      }
    }
  }
  // Path 3: User edited start date
  else if (updates.estimatedStartDate !== undefined) {
    const newStartDate = updates.estimatedStartDate ? new Date(updates.estimatedStartDate) : null;
    updateData.estimatedStartDate = newStartDate;

    // Calculate delta from old start date
    if (currentPhase.estimatedStartDate && newStartDate) {
      const oldStart = new Date(currentPhase.estimatedStartDate);
      deltaDays = Math.floor((newStartDate - oldStart) / (1000 * 60 * 60 * 24));
    }

    // If end date exists, recalculate duration
    if (newStartDate && currentPhase.estimatedEndDate) {
      const duration = calculateDurationFromDates(newStartDate, currentPhase.estimatedEndDate);
      updateData.phaseTotalDuration = duration;
    }
  }

  // Update the phase
  const updatedPhase = await prisma.workPackagePhase.update({
    where: { id: phaseId },
    data: updateData,
  });

  // Shift subsequent phases if delta changed
  if (deltaDays !== 0) {
    await shiftSubsequentPhases(phaseId, deltaDays);
  }

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

/**
 * Update WorkPackage effectiveStartDate and adjust Phase 1
 * Only Phase 1 depends on effectiveStartDate
 * 
 * @param {string} workPackageId - WorkPackage ID
 * @param {Date|string} effectiveStartDate - New effective start date
 * @returns {Promise<Object>} - Updated work package
 */
export async function upsertWorkPackageEffectiveDate(workPackageId, effectiveStartDate) {
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

  // Get Phase 1
  const phase1 = await prisma.workPackagePhase.findFirst({
    where: {
      workPackageId,
      position: 1,
    },
    select: {
      id: true,
      estimatedStartDate: true,
      estimatedEndDate: true,
    },
  });

  if (phase1) {
    // Calculate delta from old Phase 1 start
    let deltaDays = 0;
    if (phase1.estimatedStartDate) {
      const oldStart = new Date(phase1.estimatedStartDate);
      deltaDays = Math.floor((date - oldStart) / (1000 * 60 * 60 * 24));
    } else {
      // No old start date, calculate from end date if it exists
      if (phase1.estimatedEndDate) {
        const oldEnd = new Date(phase1.estimatedEndDate);
        const duration = calculateDurationFromDates(date, oldEnd);
        deltaDays = -duration; // Negative because we're moving start earlier
      }
    }

    // Update Phase 1 start date
    await prisma.workPackagePhase.update({
      where: { id: phase1.id },
      data: {
        estimatedStartDate: date,
      },
    });

    // Shift subsequent phases if Phase 1 moved
    if (deltaDays !== 0) {
      await shiftSubsequentPhases(phase1.id, deltaDays);
    }
  }

  return updatedWorkPackage;
}

/**
 * Initialize Phase 1 from WorkPackage effectiveStartDate
 * Only called when Phase 1 has no estimatedStartDate
 * 
 * @param {string} workPackageId - WorkPackage ID
 * @returns {Promise<Object|null>} - Updated Phase 1 or null
 */
export async function initializePhase1FromEffectiveDate(workPackageId) {
  const workPackage = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    select: { effectiveStartDate: true },
  });

  if (!workPackage || !workPackage.effectiveStartDate) {
    return null;
  }

  const phase1 = await prisma.workPackagePhase.findFirst({
    where: {
      workPackageId,
      position: 1,
    },
  });

  if (!phase1 || phase1.estimatedStartDate) {
    return null;
  }

  // Set Phase 1 start date to effectiveStartDate
  const updatedPhase1 = await prisma.workPackagePhase.update({
    where: { id: phase1.id },
    data: {
      estimatedStartDate: new Date(workPackage.effectiveStartDate),
    },
  });

  return updatedPhase1;
}
