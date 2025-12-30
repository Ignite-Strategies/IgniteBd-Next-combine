/**
 * Contact Cache Validation Utility
 * 
 * Validates that cached contacts belong to the current companyHQId
 * Prevents showing contacts from wrong company when switching tenants
 */

/**
 * Validate cached contacts match current companyHQId
 * 
 * @param {Array} contacts - Cached contacts array
 * @param {string} companyHQId - Current company HQ ID
 * @returns {Object} Validation result
 * @returns {boolean} result.isValid - Whether cache is valid
 * @returns {boolean} result.hasMismatch - Whether any contacts belong to different company
 * @returns {number} result.mismatchCount - Number of contacts with wrong company
 */
export function validateContactsCache(contacts, companyHQId) {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return {
      isValid: false,
      hasMismatch: false,
      mismatchCount: 0,
      reason: 'empty_or_invalid'
    };
  }

  if (!companyHQId) {
    return {
      isValid: false,
      hasMismatch: false,
      mismatchCount: 0,
      reason: 'no_company_hq_id'
    };
  }

  // Check if any contact has a different crmId than current companyHQId
  const mismatches = contacts.filter(contact => {
    // Contact should have crmId matching companyHQId
    // If crmId is missing or different, it's a mismatch
    return contact.crmId && contact.crmId !== companyHQId;
  });

  const hasMismatch = mismatches.length > 0;

  return {
    isValid: !hasMismatch,
    hasMismatch,
    mismatchCount: mismatches.length,
    reason: hasMismatch ? 'company_mismatch' : 'valid'
  };
}

/**
 * Get cached contacts from localStorage with validation
 * 
 * @param {string} companyHQId - Current company HQ ID
 * @returns {Object} Result with contacts and validation info
 * @returns {Array} result.contacts - Valid contacts array (empty if invalid)
 * @returns {boolean} result.isValid - Whether cache is valid
 * @returns {string} result.reason - Reason for invalid cache
 */
export function getValidatedContactsCache(companyHQId) {
  if (typeof window === 'undefined') {
    return {
      contacts: [],
      isValid: false,
      reason: 'server_side'
    };
  }

  if (!companyHQId) {
    return {
      contacts: [],
      isValid: false,
      reason: 'no_company_hq_id'
    };
  }

  try {
    const cached = window.localStorage.getItem('contacts');
    if (!cached) {
      return {
        contacts: [],
        isValid: false,
        reason: 'no_cache'
      };
    }

    const parsed = JSON.parse(cached);
    if (!Array.isArray(parsed)) {
      return {
        contacts: [],
        isValid: false,
        reason: 'invalid_format'
      };
    }

    // Validate contacts match current company
    const validation = validateContactsCache(parsed, companyHQId);
    
    if (!validation.isValid) {
      console.warn(`⚠️ Contact cache invalid: ${validation.reason}`, {
        companyHQId,
        mismatchCount: validation.mismatchCount
      });
      
      // Clear invalid cache
      window.localStorage.removeItem('contacts');
      
      return {
        contacts: [],
        isValid: false,
        reason: validation.reason,
        mismatchCount: validation.mismatchCount
      };
    }

    return {
      contacts: parsed,
      isValid: true,
      reason: 'valid'
    };
  } catch (error) {
    console.error('Error validating contacts cache:', error);
    
    // Clear corrupted cache
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('contacts');
    }
    
    return {
      contacts: [],
      isValid: false,
      reason: 'parse_error'
    };
  }
}

