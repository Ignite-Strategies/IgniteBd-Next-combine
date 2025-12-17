/**
 * Status Configuration - Canonical Status System
 * Single source of truth for all status values, labels, and metadata
 * Used by both owner app and client portal
 */

/**
 * Canonical Status Enum Values
 * These are the ONLY valid status values in the system
 */
export const STATUS_VALUES = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  CHANGES_NEEDED: 'CHANGES_NEEDED',
  CHANGES_IN_PROGRESS: 'CHANGES_IN_PROGRESS',
  APPROVED: 'APPROVED',
};

/**
 * Status Labels (Owner-facing)
 * Used in owner app dropdowns and displays
 */
export const STATUS_LABELS = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  CHANGES_NEEDED: 'Changes Needed',
  CHANGES_IN_PROGRESS: 'Changes In Progress',
  APPROVED: 'Approved',
};

/**
 * Status Labels (Client-facing)
 * Used in client portal displays
 */
export const STATUS_LABELS_CLIENT = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'Needs Review',
  CHANGES_NEEDED: 'Changes Requested',
  CHANGES_IN_PROGRESS: 'Changes Being Made',
  APPROVED: 'Completed',
};

/**
 * Status Colors (Tailwind classes)
 * Used for badges and UI indicators
 */
export const STATUS_COLORS = {
  NOT_STARTED: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  IN_REVIEW: 'bg-yellow-100 text-yellow-800',
  CHANGES_NEEDED: 'bg-red-100 text-red-800',
  CHANGES_IN_PROGRESS: 'bg-purple-100 text-purple-800',
  APPROVED: 'bg-green-100 text-green-800',
};

/**
 * Status Order (for dropdowns and sorting)
 */
export const STATUS_ORDER = [
  STATUS_VALUES.NOT_STARTED,
  STATUS_VALUES.IN_PROGRESS,
  STATUS_VALUES.IN_REVIEW,
  STATUS_VALUES.CHANGES_NEEDED,
  STATUS_VALUES.CHANGES_IN_PROGRESS,
  STATUS_VALUES.APPROVED,
];

/**
 * Get status configuration object
 * @param {string} status - Status value (will be normalized to uppercase)
 * @param {boolean} clientView - If true, returns client-facing labels
 * @returns {Object} Status config with value, label, color
 */
export function getStatusConfig(status, clientView = false) {
  if (!status) {
    return {
      value: STATUS_VALUES.NOT_STARTED,
      label: clientView ? STATUS_LABELS_CLIENT.NOT_STARTED : STATUS_LABELS.NOT_STARTED,
      color: STATUS_COLORS.NOT_STARTED,
    };
  }

  const normalizedStatus = status.toUpperCase();
  const labels = clientView ? STATUS_LABELS_CLIENT : STATUS_LABELS;

  return {
    value: normalizedStatus,
    label: labels[normalizedStatus] || labels.NOT_STARTED,
    color: STATUS_COLORS[normalizedStatus] || STATUS_COLORS.NOT_STARTED,
  };
}

/**
 * Get all statuses as array for dropdown options
 * @param {boolean} clientView - If true, returns client-facing labels
 * @returns {Array} Array of { value, label } objects
 */
export function getStatusOptions(clientView = false) {
  const labels = clientView ? STATUS_LABELS_CLIENT : STATUS_LABELS;
  
  return STATUS_ORDER.map((value) => ({
    value,
    label: labels[value],
  }));
}

/**
 * Validate if a status is valid
 * @param {string} status - Status value to validate
 * @returns {boolean} True if valid
 */
export function isValidStatus(status) {
  if (!status) return false;
  return Object.values(STATUS_VALUES).includes(status.toUpperCase());
}

/**
 * Get status label only
 * @param {string} status - Status value
 * @param {boolean} clientView - If true, returns client-facing label
 * @returns {string} Status label
 */
export function getStatusLabel(status, clientView = false) {
  const config = getStatusConfig(status, clientView);
  return config.label;
}

/**
 * Get status color only
 * @param {string} status - Status value
 * @returns {string} Tailwind color classes
 */
export function getStatusColor(status) {
  const config = getStatusConfig(status);
  return config.color;
}

