/**
 * Template Variables & Hydration Utility
 * 
 * This module handles:
 * 1. Variable tag parsing (e.g., {{firstName}}, {{companyName}})
 * 2. Variable extraction from template content
 * 3. Template hydration with contact data
 * 4. Time calculations (e.g., timeSinceConnected)
 */

/**
 * Parse variable tags from template content
 * @param {string} content - Template content with {{variableName}} tags
 * @returns {Array<{name: string, type: string}>} Array of variable objects
 */
export function extractVariables(content) {
  const variableRegex = /\{\{(\w+)\}\}/g;
  const matches = [...content.matchAll(variableRegex)];
  
  const variables = [];
  const seen = new Set();
  
  matches.forEach((match) => {
    const variableName = match[1];
    
    if (!seen.has(variableName)) {
      seen.add(variableName);
      variables.push({
        name: variableName,
        type: inferVariableType(variableName),
        description: generateDescription(variableName),
      });
    }
  });
  
  return variables;
}

/**
 * Infer variable type from variable name
 * @param {string} variableName 
 * @returns {string} Variable type enum value
 */
function inferVariableType(variableName) {
  const lowerName = variableName.toLowerCase();
  
  // Date fields
  if (lowerName.includes('date') || lowerName.includes('when')) {
    return 'DATE';
  }
  
  // Duration fields
  if (lowerName.includes('timesince') || lowerName.includes('duration') || lowerName.includes('howlong')) {
    return 'TIME_DURATION';
  }
  
  // Boolean fields
  if (lowerName.includes('knowledge') || lowerName.includes('knows') || lowerName.includes('aware')) {
    return 'BOOLEAN';
  }
  
  // Enum fields (year, horizon, etc.)
  if (lowerName.includes('horizon') || lowerName.includes('year') || lowerName.includes('when')) {
    return 'ENUM';
  }
  
  // Default to TEXT
  return 'TEXT';
}

/**
 * Generate human-readable description for variable
 * @param {string} variableName 
 * @returns {string}
 */
function generateDescription(variableName) {
  const descriptions = {
    firstName: "Contact's first name",
    lastName: "Contact's last name",
    companyName: "Contact's current company name",
    title: "Contact's job title",
    timeSinceConnected: "How long since you last connected (e.g., '2 years')",
    lastContactDate: "Date of last contact",
    knowledgeOfBusiness: "Whether they know about your business (yes/no)",
    timeHorizon: "When you want to connect (e.g., '2026', 'Q1 2025')",
    desiredOutcome: "What you want from them",
    myBusinessName: "Your company/business name",
    myRole: "Your job title or role",
  };
  
  return descriptions[variableName] || `Value for ${variableName}`;
}

/**
 * Calculate time since last connection
 * @param {Date|string} lastContactDate - Last contact date
 * @returns {string} Human-readable duration (e.g., "2 years", "6 months")
 */
export function calculateTimeSince(lastContactDate) {
  if (!lastContactDate) return 'a while';
  
  const lastDate = new Date(lastContactDate);
  const now = new Date();
  const diffMs = now - lastDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) {
    return 'a few weeks';
  } else if (diffDays < 60) {
    return 'about a month';
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''}`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''}`;
  }
}

/**
 * Hydrate template with contact data
 * @param {string} template - Template content with {{variableName}} tags
 * @param {Object} contactData - Contact data object
 * @param {Object} metadata - Additional metadata (e.g., desiredOutcome, timeHorizon)
 * @returns {string} Hydrated content with variables replaced
 */
export function hydrateTemplate(template, contactData = {}, metadata = {}) {
  // Ensure we have objects, not null/undefined
  const safeContactData = contactData || {};
  const safeMetadata = metadata || {};
  const safeTemplate = template || '';
  
  let hydrated = safeTemplate;
  
  const data = {
    firstName: safeContactData.firstName || safeContactData.goesBy || 'there',
    lastName: safeContactData.lastName || '',
    fullName: safeContactData.fullName || `${safeContactData.firstName || ''} ${safeContactData.lastName || ''}`.trim() || 'there',
    companyName: safeContactData.companyName || 'your company',
    title: safeContactData.title || 'your role',
    email: safeContactData.email || '',
    timeSinceConnected: calculateTimeSince(safeContactData.lastContactDate || safeContactData.updatedAt),
    knowledgeOfBusiness: safeMetadata.knowledgeOfBusiness ? 'yes' : 'no',
    timeHorizon: safeMetadata.timeHorizon || 'soon',
    desiredOutcome: safeMetadata.desiredOutcome || '',
    myBusinessName: safeMetadata.myBusinessName || 'my business',
    myRole: safeMetadata.myRole || 'consultant',
    ...safeMetadata,
  };
  
  Object.keys(data).forEach((key) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    const value = data[key] !== null && data[key] !== undefined ? data[key] : '';
    hydrated = hydrated.replace(regex, value);
  });
  
  return hydrated;
}

/**
 * Validate if template has all required variables filled
 * @param {string} content - Hydrated content
 * @returns {Object} { valid: boolean, missingVariables: string[] }
 */
export function validateHydration(content) {
  const variableRegex = /\{\{(\w+)\}\}/g;
  const matches = [...content.matchAll(variableRegex)];
  const missingVariables = matches.map(m => m[1]);
  
  return {
    valid: missingVariables.length === 0,
    missingVariables,
  };
}

/**
 * Generate example template content based on the user's use case
 * @param {Object} templateBase - Template base with relationship, typeOfPerson, etc.
 * @returns {string} Template content with variable tags
 */
export function generateTemplateWithVariables(templateBase) {
  const { relationship, typeOfPerson, whyReachingOut, whatWantFromThem } = templateBase;
  
  // Opening with variable
  let template = `Hi {{firstName}},\n\n`;
  
  // Acknowledge time since connection (if relationship is DORMANT or WARM)
  if (relationship === 'DORMANT') {
    template += `I know it's been {{timeSinceConnected}} since we connected. `;
  } else if (relationship === 'WARM') {
    template += `It's been a while since we last talked. `;
  }
  
  // Context based on whyReachingOut
  template += `${whyReachingOut} `;
  
  // Add company reference if relevant
  if (typeOfPerson === 'FORMER_COWORKER' || typeOfPerson === 'PROSPECT') {
    template += `I saw you recently started working at {{companyName}}. `;
  }
  
  // Business awareness check (optional section)
  template += `Not sure if you knew, but I run {{myBusinessName}}. `;
  
  // Time horizon for connecting
  template += `\n\nLet's get together in {{timeHorizon}}`;
  
  // What you want from them
  if (whatWantFromThem) {
    template += ` — ${whatWantFromThem}`;
  } else {
    template += ` to catch up`;
  }
  
  template += `.\n\n`;
  
  // Release valve
  template += `No pressure at all — just wanted to reach out.\n\n`;
  
  // Closing
  template += `Cheers to what's ahead!\n\n`;
  template += `{{myRole}}`;
  
  return template;
}

/**
 * Get default variable values for preview mode
 * @returns {Object} Default values for all common variables
 */
export function getDefaultVariableValues() {
  return {
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    companyName: 'Acme Corp',
    title: 'Director of Engineering',
    timeSinceConnected: '2 years',
    knowledgeOfBusiness: 'no',
    timeHorizon: '2026',
    desiredOutcome: 'see if we can collaborate',
    myBusinessName: 'my NDA house',
    myRole: 'Joel',
  };
}
