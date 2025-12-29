/**
 * Tenant Switching Utility
 * 
 * Provides functions for SuperAdmin to switch between tenants
 */

import { wipeTenantData } from './localStorageWiper';

/**
 * Switch to a different tenant
 * Wipes old tenant data before switching
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
    // Get current companyHQId before wiping
    const currentCompanyHQId = localStorage.getItem('companyHQId');
    
    // Only wipe if we're actually switching to a different company
    if (currentCompanyHQId !== companyHQId) {
      console.log(`🔄 Switching tenant from ${currentCompanyHQId} to ${companyHQId} - wiping tenant data...`);
      
      // Wipe all tenant-scoped data (preserves auth, owner, memberships)
      // Sets new companyHQId in the process
      wipeTenantData({ 
        preserveCompanyHQ: false,
        newCompanyHQId: companyHQId 
      });
    } else {
      // Same company, just set it (no wipe needed)
      localStorage.setItem('companyHQId', companyHQId);
    }
    
    // TODO WEDNESDAY FIX #1: Redirect to tenant hydration gateway instead of direct dashboard
    window.location.href = '/growth-dashboard';
  }
}

