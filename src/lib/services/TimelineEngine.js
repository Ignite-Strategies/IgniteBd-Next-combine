/**
 * Timeline Engine Service
 * Calculates completion dates using business-day addition (skip weekends)
 */

/**
 * Add business days to a date (excludes weekends)
 * @param {Date} startDate - Starting date
 * @param {number} businessDays - Number of business days to add
 * @returns {Date} - Completion date
 */
export function addBusinessDays(startDate, businessDays) {
  const date = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    date.setDate(date.getDate() + 1);
    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  return date;
}

/**
 * Calculate timeline for a work package
 * @param {Date} estimatedStartDate - Project start date
 * @param {Array} phases - Array of WorkPackagePhase with phaseTotalDuration
 * @returns {Object} - Timeline with per-phase dates and total completion
 */
export function calculateWorkPackageTimeline(estimatedStartDate, phases) {
  const timeline = {
    startDate: new Date(estimatedStartDate),
    phases: [],
    totalDuration: 0,
    completionDate: null,
  };

  let currentDate = new Date(estimatedStartDate);

  // Sort phases by position
  const sortedPhases = [...phases].sort((a, b) => a.position - b.position);

  sortedPhases.forEach((phase) => {
    const phaseStartDate = new Date(currentDate);
    const phaseEndDate = addBusinessDays(currentDate, phase.phaseTotalDuration);
    
    timeline.phases.push({
      phaseId: phase.id,
      phaseName: phase.name,
      position: phase.position,
      startDate: phaseStartDate,
      endDate: phaseEndDate,
      duration: phase.phaseTotalDuration,
    });

    timeline.totalDuration += phase.phaseTotalDuration;
    
    // Next phase starts the day after this phase ends
    currentDate = new Date(phaseEndDate);
    currentDate.setDate(currentDate.getDate() + 1);
  });

  if (sortedPhases.length > 0) {
    const lastPhase = timeline.phases[timeline.phases.length - 1];
    timeline.completionDate = lastPhase.endDate;
  }

  return timeline;
}

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

