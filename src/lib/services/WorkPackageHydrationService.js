import { prisma } from '../prisma';
import { computeExpectedEndDate, computePhaseTimelineStatus } from '../utils/workPackageTimeline';
import { upsertPhaseTotalDuration } from './PhaseDurationService';
import { calculatePhaseEffectiveDate } from './PhaseDueDateService';

/**
 * Hydrate WorkPackage with WorkCollateral and calculate progress
 * Uses WorkCollateral model as source of truth
 * @param {Object} workPackage - WorkPackage from Prisma (with workCollateral already included)
 * @param {Object} options - Options for hydration
 * @param {boolean} options.clientView - If true, only return published collateral
 * @param {boolean} options.includeTimeline - If true, include timeline calculations (default: true for owner view)
 * @returns {Promise<Object>} - Hydrated work package with progress
 */
export async function hydrateWorkPackage(workPackage, options = {}) {
  const { clientView = false, includeTimeline = !clientView } = options;

  // Hydrate each item with its WorkCollateral
  const hydratedItems = await Promise.all(
    workPackage.items.map(async (item) => {
      // Get WorkCollateral for this item
      const workCollateral = await prisma.workCollateral.findMany({
        where: { workPackageItemId: item.id },
      });

      const completedCount = workCollateral.filter(
        (wc) => wc.status === 'APPROVED'
      ).length;

      const progress = {
        completed: completedCount,
        total: item.quantity,
        percentage: item.quantity > 0 ? Math.round((completedCount / item.quantity) * 100) : 0,
      };

      return {
        ...item,
        workCollateral,
        progress,
      };
    })
  );

  // Calculate overall progress
  const totalItems = hydratedItems.length;
  const completedItems = hydratedItems.filter(
    (item) => item.progress.completed >= item.progress.total
  ).length;
  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Hydrate phases with aggregated hours and timeline calculations
  let hydratedPhases = [];
  if (workPackage.phases && Array.isArray(workPackage.phases)) {
    // First, upsert phaseTotalDuration for all phases based on calculated hours
    await Promise.all(
      workPackage.phases.map(async (phase) => {
        const phaseItems = hydratedItems.filter((item) => item.workPackagePhaseId === phase.id);
        const aggregatedHours = phaseItems.reduce((sum, item) => {
          return sum + (item.estimatedHoursEach || 0) * (item.quantity || 0);
        }, 0);

        // Only update if hours have changed
        const currentHours = phase.totalEstimatedHours || 0;
        if (aggregatedHours !== currentHours && aggregatedHours > 0) {
          try {
            await upsertPhaseTotalDuration(phase.id, aggregatedHours);
          } catch (error) {
            console.warn(`Failed to upsert phaseTotalDuration for phase ${phase.id}:`, error);
          }
        }
      })
    );

    // Then hydrate phases for response
    // Use actual dates when available for progressive calculation
    let progressiveStartDate = workPackage.effectiveStartDate 
      ? new Date(workPackage.effectiveStartDate) 
      : null;

    hydratedPhases = workPackage.phases.map((phase) => {
      // Calculate aggregated hours from items in this phase
      const phaseItems = hydratedItems.filter((item) => item.workPackagePhaseId === phase.id);
      const aggregatedHours = phaseItems.reduce((sum, item) => {
        return sum + (item.estimatedHoursEach || 0) * (item.quantity || 0);
      }, 0);

      // Determine effective date for this phase:
      // 1. If phase has actualStartDate, use it (phase already started)
      // 2. Otherwise, calculate from WorkPackage start + previous phases
      //    (using actual dates from previous phases when available)
      let effectiveDate = null;
      if (includeTimeline) {
        if (phase.actualStartDate) {
          // Phase has actually started - use actual start date
          effectiveDate = new Date(phase.actualStartDate);
        } else {
          // Calculate from progressive start date (which uses actual dates from previous phases)
          effectiveDate = progressiveStartDate;
        }
      }

      // Calculate expectedEndDate:
      // Use actualEndDate if phase is completed, otherwise calculate from effectiveDate
      let expectedEndDate = null;
      if (includeTimeline) {
        if (phase.actualEndDate) {
          // Phase is completed - use actual end date
          expectedEndDate = new Date(phase.actualEndDate);
        } else if (effectiveDate) {
          // Calculate from effective date + hours
          expectedEndDate = computeExpectedEndDate(
            effectiveDate, 
            aggregatedHours || phase.totalEstimatedHours || 0
          );
        }
      }

      // Update progressive start date for next phase:
      // Use actualEndDate if available, otherwise use calculated expectedEndDate
      if (includeTimeline) {
        const phaseEndDate = phase.actualEndDate 
          ? new Date(phase.actualEndDate)
          : expectedEndDate;
        
        if (phaseEndDate) {
          progressiveStartDate = new Date(phaseEndDate);
          progressiveStartDate.setDate(progressiveStartDate.getDate() + 1);
        }
      }

      // Calculate phase status from items (derive from item statuses)
      // Phase is completed if all items are completed
      const allItemsCompleted = phaseItems.length > 0 && phaseItems.every(
        (item) => item.status === 'completed' || (item.progress?.completed >= item.progress?.total)
      );
      const hasInProgressItems = phaseItems.some((item) => item.status === 'in_progress');
      const phaseStatus = allItemsCompleted ? 'completed' : (hasInProgressItems ? 'in_progress' : 'active');

      // Calculate timeline status
      const timelineStatus = includeTimeline
        ? computePhaseTimelineStatus(phaseStatus, expectedEndDate)
        : null;

      return {
        ...phase,
        totalEstimatedHours: aggregatedHours || phase.totalEstimatedHours || 0,
        // Include stored dates
        estimatedStartDate: phase.estimatedStartDate ? new Date(phase.estimatedStartDate).toISOString() : null,
        estimatedEndDate: phase.estimatedEndDate ? new Date(phase.estimatedEndDate).toISOString() : null,
        actualStartDate: phase.actualStartDate ? new Date(phase.actualStartDate).toISOString() : null,
        actualEndDate: phase.actualEndDate ? new Date(phase.actualEndDate).toISOString() : null,
        status: phase.status || null,
        // Calculated effective date (uses actual if available)
        effectiveDate: effectiveDate ? effectiveDate.toISOString() : null,
        // Calculated expected end date (uses actual if available)
        expectedEndDate: expectedEndDate ? expectedEndDate.toISOString() : null,
        timelineStatus,
        items: phaseItems,
      };
    });

    // Sort phases by position
    hydratedPhases.sort((a, b) => a.position - b.position);
  }

  return {
    ...workPackage,
    items: hydratedItems,
    phases: hydratedPhases,
    progress: {
      completed: completedItems,
      total: totalItems,
      percentage: overallProgress,
    },
  };
}
