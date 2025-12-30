/**
 * Simple localStorage utilities - NO HOOKS, NO DELAYS
 * Direct synchronous reads from localStorage
 * 
 * Use these instead of useOwner/useCompanyHQ hooks to avoid delays and complexity
 */

/**
 * Get ownerId from localStorage (synchronous)
 */
export function getOwnerId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ownerId');
}

/**
 * Get owner object from localStorage (synchronous)
 */
export function getOwner() {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('owner');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Get companyHQId from localStorage (synchronous)
 */
export function getCompanyHQId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('companyHQId');
}

/**
 * Get companyHQ object from localStorage (synchronous)
 */
export function getCompanyHQ() {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('companyHQ');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Get memberships array from localStorage (synchronous)
 */
export function getMemberships() {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('memberships');
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// NO HOOKS - just read localStorage directly when you need it
// Example: const ownerId = typeof window !== 'undefined' ? localStorage.getItem('ownerId') : null;

