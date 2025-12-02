/**
 * Tenant Switching Utility
 * 
 * Simple utility for switching between tenants
 */

/**
 * Switch to a different tenant
 * 
 * @param {string} companyHQId - The CompanyHQ ID to switch to
 */
export function switchTenant(companyHQId) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('companyHQId', companyHQId);
    window.location.href = '/growth-dashboard';
  }
}

