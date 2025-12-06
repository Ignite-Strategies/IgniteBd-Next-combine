/**
 * Tenant Switching Utility
 * 
 * Simple utility for switching between tenants
 */

/**
 * Switch to a different tenant
 * 
 * @param {string} companyHQId - The CompanyHQ ID to switch to
 * 
 * TODO WEDNESDAY FIX #1: Tenant Switch Hydration Gateway
 * - Write new companyHQId before redirecting to hydration gateway
 * - Redirect to /tenant-hydrate instead of direct dashboard
 * - The /tenant-hydrate route will reset stores and re-hydrate data
 */
export function switchTenant(companyHQId) {
  if (typeof window !== 'undefined') {
    // TODO WEDNESDAY FIX #1: Write new companyHQId before redirecting to hydration gateway
    localStorage.setItem('companyHQId', companyHQId);
    // TODO WEDNESDAY FIX #1: Redirect to tenant hydration gateway instead of direct dashboard
    window.location.href = '/growth-dashboard';
  }
}

