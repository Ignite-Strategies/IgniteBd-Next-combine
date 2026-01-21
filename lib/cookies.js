/**
 * Cookie Utilities - NO HOOKS
 * Simple cookie getter/setter - no React state, no hooks
 * Can be used in client components and server routes
 */

/**
 * Get cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null} - Cookie value or null
 */
export function getCookie(name) {
  if (typeof document === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
}

/**
 * Set cookie
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} days - Days until expiration (default: 30)
 */
export function setCookie(name, value, days = 30) {
  if (typeof document === 'undefined') return;
  
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * Delete cookie
 * @param {string} name - Cookie name
 */
export function deleteCookie(name) {
  if (typeof document === 'undefined') return;
  
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}

/**
 * Get companyHQId from cookie (with localStorage fallback for migration)
 * @returns {string|null}
 */
export function getCompanyHQId() {
  // Try cookie first
  const cookieValue = getCookie('companyHQId');
  if (cookieValue) return cookieValue;
  
  // Fallback to localStorage (for migration)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
    if (stored) {
      // Migrate to cookie
      setCookie('companyHQId', stored);
      return stored;
    }
  }
  
  return null;
}

/**
 * Set companyHQId in cookie (and sync to localStorage for backward compatibility)
 * @param {string} companyHQId
 */
export function setCompanyHQId(companyHQId) {
  setCookie('companyHQId', companyHQId);
  // Also set in localStorage for backward compatibility
  if (typeof window !== 'undefined') {
    localStorage.setItem('companyHQId', companyHQId);
  }
}

/**
 * Get ownerId from cookie (with localStorage fallback for migration)
 * @returns {string|null}
 */
export function getOwnerId() {
  // Try cookie first
  const cookieValue = getCookie('ownerId');
  if (cookieValue) return cookieValue;
  
  // Fallback to localStorage (for migration)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('ownerId');
    if (stored) {
      // Migrate to cookie
      setCookie('ownerId', stored);
      return stored;
    }
  }
  
  return null;
}

/**
 * Set ownerId in cookie (and sync to localStorage for backward compatibility)
 * @param {string} ownerId
 */
export function setOwnerId(ownerId) {
  setCookie('ownerId', ownerId);
  // Also set in localStorage for backward compatibility
  if (typeof window !== 'undefined') {
    localStorage.setItem('ownerId', ownerId);
  }
}

