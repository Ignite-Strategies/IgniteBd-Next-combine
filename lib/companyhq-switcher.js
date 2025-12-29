/**
 * CompanyHQ Switcher Utility
 * 
 * Allows owners with multiple memberships to switch between CompanyHQs
 */

/**
 * Switch to a different CompanyHQ
 * Updates localStorage and returns the new CompanyHQ data
 * 
 * @param {string} companyHQId - The CompanyHQ ID to switch to
 * @returns {Object|null} The CompanyHQ data or null if not found
 */
export function switchCompanyHQ(companyHQId) {
  if (typeof window === 'undefined') return null;

  // Get memberships from localStorage
  const storedMemberships = localStorage.getItem('memberships');
  if (!storedMemberships) {
    console.warn('No memberships found in localStorage');
    return null;
  }

  let memberships;
  try {
    memberships = JSON.parse(storedMemberships);
  } catch (error) {
    console.error('Failed to parse memberships:', error);
    return null;
  }

  // Find the membership for this CompanyHQ
  const membership = memberships.find(m => m.companyHqId === companyHQId);
  if (!membership) {
    console.warn(`No membership found for CompanyHQ: ${companyHQId}`);
    return null;
  }

  // Update localStorage with new current CompanyHQ
  localStorage.setItem('companyHQId', membership.companyHqId);
  localStorage.setItem('companyHQ', JSON.stringify(membership.company_hqs));

  // Dispatch custom event for same-tab listeners
  window.dispatchEvent(new CustomEvent('companyHQContextChanged', {
    detail: { companyHQId: membership.companyHqId }
  }));

  // Also trigger storage event manually (for same-tab listeners)
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'companyHQId',
    newValue: membership.companyHqId,
  }));

  console.log(`✅ Switched to CompanyHQ: ${membership.company_hqs.companyName}`);

  return {
    companyHQId: membership.companyHqId,
    companyHQ: membership.company_hqs,
    role: membership.role,
  };
}

/**
 * Get current CompanyHQ from localStorage
 * @returns {string|null} Current CompanyHQ ID
 */
export function getCurrentCompanyHQId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('companyHQId');
}

/**
 * Get all memberships from localStorage
 * @returns {Array} Array of memberships
 */
export function getAllMemberships() {
  if (typeof window === 'undefined') return [];
  
  const storedMemberships = localStorage.getItem('memberships');
  if (!storedMemberships) return [];

  try {
    return JSON.parse(storedMemberships);
  } catch (error) {
    console.error('Failed to parse memberships:', error);
    return [];
  }
}

/**
 * Check if owner has membership in a specific CompanyHQ
 * @param {string} companyHQId - The CompanyHQ ID to check
 * @returns {boolean}
 */
export function hasMembership(companyHQId) {
  const memberships = getAllMemberships();
  return memberships.some(m => m.companyHqId === companyHQId);
}

/**
 * Get role for a specific CompanyHQ
 * @param {string} companyHQId - The CompanyHQ ID
 * @returns {string|null} Role (OWNER, MANAGER, etc.) or null
 */
export function getRole(companyHQId) {
  const memberships = getAllMemberships();
  const membership = memberships.find(m => m.companyHqId === companyHQId);
  return membership?.role || null;
}
