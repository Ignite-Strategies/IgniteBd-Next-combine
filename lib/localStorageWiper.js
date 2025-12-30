/**
 * LocalStorage Wiper Service
 * 
 * Clears tenant-scoped localStorage data when switching CompanyHQs.
 * Preserves authentication and owner data, but wipes all company-specific data.
 */

/**
 * List of tenant-scoped localStorage keys to clear when switching companies
 * These are all data that is scoped to a specific CompanyHQ
 */
const TENANT_SCOPED_KEYS = [
  // Business Data
  'contacts',
  'contactLists',
  'personas',
  'personaId',
  'products',
  'pipelines',
  'proposals',
  'outreachCampaigns',
  'campaigns', // legacy
  
  // Company hydration cache (will clear all patterns like companyHydration_*)
  // Handled separately below
  
  // Work packages & templates
  'workPackages',
  'phaseTemplates',
  'deliverableTemplates',
  
  // Legacy/deprecated
  'personaData', // legacy
  'companies', // legacy
  'companyId', // legacy (should use companyHQId)
  
  // Client portal (company-scoped)
  'clientPortalProposalId',
];

/**
 * Keys to preserve during wipe (auth and owner data)
 */
const PRESERVED_KEYS = [
  'firebaseToken',
  'firebaseId',
  'ownerId',
  'owner',
  'memberships',
  // Note: companyHQId and companyHQ will be cleared and re-set by the switcher
];

/**
 * Wipe all tenant-scoped localStorage data
 * Preserves authentication and owner data
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.preserveCompanyHQ - If true, preserves companyHQId and companyHQ (default: false)
 * @param {string} options.newCompanyHQId - If provided, will clear old companyHQId/companyHQ before setting new ones
 * @returns {Object} Summary of what was cleared
 */
export function wipeTenantData(options = {}) {
  if (typeof window === 'undefined') {
    console.warn('⚠️ wipeTenantData called on server side');
    return { cleared: [], preserved: [], errors: [] };
  }

  const { preserveCompanyHQ = false, newCompanyHQId = null } = options;
  const cleared = [];
  const preserved = [];
  const errors = [];

  // Clear all tenant-scoped keys
  TENANT_SCOPED_KEYS.forEach(key => {
    try {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        cleared.push(key);
      }
    } catch (error) {
      console.error(`Error clearing localStorage key "${key}":`, error);
      errors.push({ key, error: error.message });
    }
  });

  // Clear company hydration cache (pattern: companyHydration_*)
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('companyHydration_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      cleared.push(key);
    });
  } catch (error) {
    console.error('Error clearing companyHydration cache:', error);
    errors.push({ key: 'companyHydration_*', error: error.message });
  }

  // Clear companyHQId and companyHQ
  // CRITICAL: Only clear if preserveCompanyHQ is explicitly false
  // If preserveCompanyHQ is true OR newCompanyHQId is provided, preserve/set it
  if (preserveCompanyHQ) {
    // Preserve companyHQId/companyHQ
    preserved.push('companyHQId', 'companyHQ');
    
    // If newCompanyHQId provided, update it (but don't clear first)
    if (newCompanyHQId) {
      try {
        localStorage.setItem('companyHQId', newCompanyHQId);
        console.log(`✅ Wiper: Updated companyHQId to: ${newCompanyHQId} (preserved during wipe)`);
      } catch (error) {
        console.error('Error setting new companyHQId:', error);
        errors.push({ key: 'companyHQId (set)', error: error.message });
      }
    }
  } else if (newCompanyHQId) {
    // preserveCompanyHQ is false but we have a new one - clear old, set new
    try {
      if (localStorage.getItem('companyHQId') !== null) {
        localStorage.removeItem('companyHQId');
        cleared.push('companyHQId');
      }
      if (localStorage.getItem('companyHQ') !== null) {
        localStorage.removeItem('companyHQ');
        cleared.push('companyHQ');
      }
      // Set new one
      localStorage.setItem('companyHQId', newCompanyHQId);
      console.log(`✅ Wiper: Replaced companyHQId with: ${newCompanyHQId}`);
    } catch (error) {
      console.error('Error replacing companyHQ data:', error);
      errors.push({ key: 'companyHQId/companyHQ', error: error.message });
    }
  } else {
    // preserveCompanyHQ is false and no newCompanyHQId - clear it
    try {
      if (localStorage.getItem('companyHQId') !== null) {
        localStorage.removeItem('companyHQId');
        cleared.push('companyHQId');
      }
      if (localStorage.getItem('companyHQ') !== null) {
        localStorage.removeItem('companyHQ');
        cleared.push('companyHQ');
      }
    } catch (error) {
      console.error('Error clearing companyHQ data:', error);
      errors.push({ key: 'companyHQId/companyHQ', error: error.message });
    }
  }

  // Log what was preserved
  PRESERVED_KEYS.forEach(key => {
    if (localStorage.getItem(key) !== null) {
      preserved.push(key);
    }
  });

  console.log(`🧹 Wiped tenant data: ${cleared.length} keys cleared, ${preserved.length} keys preserved`);
  if (cleared.length > 0) {
    console.log('  Cleared:', cleared.join(', '));
  }
  if (errors.length > 0) {
    console.warn('  Errors:', errors);
  }

  return {
    cleared,
    preserved,
    errors,
  };
}

/**
 * Wipe specific tenant-scoped key
 * @param {string} key - localStorage key to clear
 */
export function wipeKey(key) {
  if (typeof window === 'undefined') return;
  
  try {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      console.log(`🧹 Cleared localStorage key: ${key}`);
    }
  } catch (error) {
    console.error(`Error clearing localStorage key "${key}":`, error);
    throw error;
  }
}

/**
 * Check if a key should be preserved during tenant wipe
 * @param {string} key - localStorage key to check
 * @returns {boolean}
 */
export function isPreservedKey(key) {
  return PRESERVED_KEYS.includes(key);
}

/**
 * Check if a key is tenant-scoped (should be wiped)
 * @param {string} key - localStorage key to check
 * @returns {boolean}
 */
export function isTenantScopedKey(key) {
  return TENANT_SCOPED_KEYS.includes(key) || key.startsWith('companyHydration_');
}
