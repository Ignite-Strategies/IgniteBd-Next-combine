/**
 * Email Formatting Utilities
 * Formats email addresses with display names
 */

/**
 * Format email with display name
 * @param {string} email - Email address
 * @param {string} name - Display name (optional)
 * @returns {string} Formatted as "Name <email>" or just "email" if no name
 */
export function formatEmailWithName(email, name) {
  if (!email) return '';
  
  const trimmedEmail = email.trim();
  const trimmedName = name?.trim();
  
  if (trimmedName) {
    return `${trimmedName} <${trimmedEmail}>`;
  }
  
  return trimmedEmail;
}

/**
 * Parse email string to extract email and name
 * Handles formats: "Name <email>", "email", "Name email"
 * @param {string} emailString - Email string in various formats
 * @returns {Object} { email: string, name: string | null }
 */
export function parseEmailString(emailString) {
  if (!emailString) return { email: '', name: null };
  
  const trimmed = emailString.trim();
  
  // Format: "Name <email>"
  const angleBracketMatch = trimmed.match(/^(.+?)\s*<(.+?)>$/);
  if (angleBracketMatch) {
    return {
      email: angleBracketMatch[2].trim(),
      name: angleBracketMatch[1].trim() || null,
    };
  }
  
  // Format: "email" (just email)
  if (trimmed.includes('@')) {
    return {
      email: trimmed,
      name: null,
    };
  }
  
  // Fallback
  return {
    email: trimmed,
    name: null,
  };
}

/**
 * Format contact for email display
 * @param {Object} contact - Contact object with email, firstName, lastName, goesBy
 * @returns {string} Formatted as "Display Name <email>"
 */
export function formatContactEmail(contact) {
  if (!contact?.email) return '';
  
  const name = contact.goesBy || 
               [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
               contact.fullName ||
               null;
  
  return formatEmailWithName(contact.email, name);
}

