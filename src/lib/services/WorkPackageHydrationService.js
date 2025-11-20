import { prisma } from '../prisma';
import { computePhaseTimelineStatus } from '../utils/workPackageTimeline';

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

  // Hydration is read-only - do not mutate database
  // effectiveStartDate should be set via API, not during hydration

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

  // Hydrate phases - READ-ONLY (no database mutations)
  let hydratedPhases = [];
  if (workPackage.phases && Array.isArray(workPackage.phases)) {
    hydratedPhases = workPackage.phases.map((phase) => {
      // Calculate aggregated hours from items in this phase (read-only, for display)
      const phaseItems = hydratedItems.filter((item) => item.workPackagePhaseId === phase.id);
      const aggregatedHours = phaseItems.reduce((sum, item) => {
        return sum + (item.estimatedHoursEach || 0) * (item.quantity || 0);
      }, 0);

      // Use stored dates as-is (database is source of truth)
      const effectiveDate = phase.estimatedStartDate 
        ? new Date(phase.estimatedStartDate)
        : (phase.position === 1 && workPackage.effectiveStartDate)
          ? new Date(workPackage.effectiveStartDate)
          : null;

      // Use stored end date, or calculate from start + duration if needed (read-only for display)
      let expectedEndDate = null;
      if (includeTimeline) {
        if (phase.actualEndDate) {
          // Phase is completed - use actual end date
          expectedEndDate = new Date(phase.actualEndDate);
        } else if (phase.estimatedEndDate) {
          // Use stored estimatedEndDate
          expectedEndDate = new Date(phase.estimatedEndDate);
        } else if (effectiveDate && phase.phaseTotalDuration) {
          // Fallback: calculate from start + duration (read-only, for display only)
          expectedEndDate = new Date(effectiveDate);
          expectedEndDate.setDate(expectedEndDate.getDate() + phase.phaseTotalDuration);
        }
      }

      // Calculate phase status from items (read-only, for display)
      const allItemsCompleted = phaseItems.length > 0 && phaseItems.every(
        (item) => item.status === 'completed' || (item.progress?.completed >= item.progress?.total)
      );
      const hasInProgressItems = phaseItems.some((item) => item.status === 'in_progress');
      const phaseStatus = phase.status || (allItemsCompleted ? 'completed' : (hasInProgressItems ? 'in_progress' : 'not_started'));

      // Calculate timeline status (read-only, for display)
      const timelineStatus = includeTimeline
        ? computePhaseTimelineStatus(phaseStatus, expectedEndDate || phase.estimatedEndDate)
        : null;

      return {
        ...phase,
        // Include stored values (source of truth)
        totalEstimatedHours: phase.totalEstimatedHours || aggregatedHours || 0,
        estimatedStartDate: phase.estimatedStartDate ? new Date(phase.estimatedStartDate).toISOString() : null,
        estimatedEndDate: phase.estimatedEndDate ? new Date(phase.estimatedEndDate).toISOString() : null,
        actualStartDate: phase.actualStartDate ? new Date(phase.actualStartDate).toISOString() : null,
        actualEndDate: phase.actualEndDate ? new Date(phase.actualEndDate).toISOString() : null,
        status: phase.status || null,
        phaseTotalDuration: phase.phaseTotalDuration || null,
        // Calculated fields for UI (read-only, not stored)
        effectiveDate: effectiveDate ? effectiveDate.toISOString() : null,
        expectedEndDate: expectedEndDate ? expectedEndDate.toISOString() : null,
        timelineStatus,
        items: phaseItems,
      };
    });

    // Sort phases by position
    hydratedPhases.sort((a, b) => a.position - b.position);
    
    // Determine current phase: first phase that is not_started or in_progress
    const currentPhase = hydratedPhases.find(
      (phase) => phase.status === 'not_started' || phase.status === 'in_progress'
    ) || null;
    
    // Add currentPhase to hydrated work package
    return {
      ...workPackage,
      items: hydratedItems,
      phases: hydratedPhases,
      currentPhase, // First phase in queue (not_started or in_progress)
      progress: {
        completed: completedItems,
        total: totalItems,
        percentage: overallProgress,
      },
    };
  }

  return {
    ...workPackage,
    items: hydratedItems,
    phases: hydratedPhases,
    currentPhase: null, // No phases or all completed
    progress: {
      completed: completedItems,
      total: totalItems,
      percentage: overallProgress,
    },
  };
}
