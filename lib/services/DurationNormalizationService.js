/**
 * Duration Normalization Service
 * Converts durations to normalized business days
 */

/**
 * Normalize duration to business days
 * @param {number} duration - The duration value
 * @param {string} unitOfMeasure - "day" | "week" | "month"
 * @returns {number} - Normalized business days
 */
export function normalizeDuration(duration, unitOfMeasure) {
  switch (unitOfMeasure) {
    case 'day':
      return duration;
    case 'week':
      return duration * 5; // 5 business days per week
    case 'month':
      return duration * 20; // 20 business days per month
    default:
      return duration; // Default to days
  }
}

/**
 * Calculate total duration for an item (normalized * quantity)
 * @param {Object} item - WorkPackageItem with duration, unitOfMeasure, quantity
 * @returns {number} - Total normalized business days
 */
export function calculateItemTotalDuration(item) {
  const normalized = normalizeDuration(item.duration, item.unitOfMeasure);
  return normalized * item.quantity;
}

/**
 * Calculate phase total duration from all items
 * @param {Array} items - Array of WorkPackageItem objects
 * @returns {number} - Total normalized business days for the phase
 */
export function calculatePhaseTotalDuration(items) {
  if (!items || items.length === 0) return 0;
  return items.reduce((total, item) => {
    return total + calculateItemTotalDuration(item);
  }, 0);
}

