/**
 * COMPANY ENRICHMENT SERVICE
 * Infers and enriches company data from available information
 * 
 * Main functions:
 * - Infer website URL from email domain
 * - Extract domain from email
 */

/**
 * Extract domain from email address
 * @param {string} email - Email address
 * @returns {string|null} - Domain or null if invalid
 */
export function extractDomainFromEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }

  // Basic email validation and domain extraction
  const emailRegex = /^[^\s@]+@([^\s@]+)$/;
  const match = email.match(emailRegex);
  
  if (!match || !match[1]) {
    return null;
  }

  return match[1].toLowerCase();
}

/**
 * Infer website URL from email domain
 * Tries common patterns: https://domain.com and https://www.domain.com
 * 
 * @param {string} email - Email address
 * @returns {string|null} - Inferred website URL or null
 */
export function inferWebsiteFromEmail(email) {
  const domain = extractDomainFromEmail(email);
  
  if (!domain) {
    return null;
  }

  // Try www version first (most common)
  return `https://www.${domain}`;
}

/**
 * Infer website URL from email domain (non-www version)
 * 
 * @param {string} email - Email address
 * @returns {string|null} - Inferred website URL or null
 */
export function inferWebsiteFromEmailNoWWW(email) {
  const domain = extractDomainFromEmail(email);
  
  if (!domain) {
    return null;
  }

  return `https://${domain}`;
}

/**
 * Enrich company data from contact email
 * Adds inferred website URL if not already provided
 * 
 * @param {Object} companyData - Company data object
 * @param {string} contactEmail - Contact's email address
 * @returns {Object} - Enriched company data
 */
export function enrichCompanyFromEmail(companyData, contactEmail) {
  if (!companyData || !contactEmail) {
    return companyData;
  }

  // Only infer if website/URL not already provided
  // Check if companyData has website/url field (depends on schema)
  // For now, we'll assume it's stored as 'website' or 'url'
  const hasWebsite = companyData.website || companyData.url || companyData.companyWebsite;
  
  if (!hasWebsite) {
    const inferredUrl = inferWebsiteFromEmail(contactEmail);
    if (inferredUrl) {
      // Add to companyData - field name depends on schema
      // Company model might need 'website' or 'url' field added
      return {
        ...companyData,
        website: inferredUrl  // Or 'url' or 'companyWebsite' depending on schema
      };
    }
  }

  return companyData;
}

/**
 * Extract company name from email domain (basic heuristic)
 * Converts domain to readable company name
 * 
 * @param {string} email - Email address
 * @returns {string|null} - Inferred company name or null
 */
export function inferCompanyNameFromEmail(email) {
  const domain = extractDomainFromEmail(email);
  
  if (!domain) {
    return null;
  }

  // Remove common TLDs and www
  let name = domain.replace(/^www\./, '').split('.')[0];
  
  // Capitalize first letter of each word
  name = name.split(/[-_]/).map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  return name;
}

