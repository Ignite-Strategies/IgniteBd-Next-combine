/**
 * Variable Catalogue - CLIENT-SAFE
 * 
 * Client-safe exports for variable catalogue and utilities.
 * This file does NOT import prisma or any server-side dependencies.
 */

'use client';

/**
 * Variable catalogue - maps variable names to their definitions
 * This is a static object, safe for client-side use
 */
export const VariableCatalogue = {
  // CONTACT variables (from Contact model)
  firstName: {
    key: 'firstName',
    source: 'CONTACT',
    description: "Contact's first name",
    dbField: 'firstName',
  },
  lastName: {
    key: 'lastName',
    source: 'CONTACT',
    description: "Contact's last name",
    dbField: 'lastName',
  },
  fullName: {
    key: 'fullName',
    source: 'CONTACT',
    description: "Contact's full name",
    dbField: 'fullName',
  },
  goesBy: {
    key: 'goesBy',
    source: 'CONTACT',
    description: "Name contact prefers to be called",
    dbField: 'goesBy',
  },
  companyName: {
    key: 'companyName',
    source: 'CONTACT',
    description: "Contact's current company name",
    dbField: 'companyName',
  },
  title: {
    key: 'title',
    source: 'CONTACT',
    description: "Contact's job title",
    dbField: 'title',
  },
  email: {
    key: 'email',
    source: 'CONTACT',
    description: "Contact's email address",
    dbField: 'email',
  },
  // COMPUTED variables (derived from contact data)
  timeSinceConnected: {
    key: 'timeSinceConnected',
    source: 'COMPUTED',
    description: "How long since you last connected",
    computed: true,
  },
};

/**
 * Extract variable names from text (e.g., "Hello {{firstName}}" -> ["firstName"])
 * Pure function - no server dependencies
 * 
 * @param {string} text - Text containing variables like {{variableName}}
 * @returns {string[]} Array of variable names found
 */
export function extractVariableNames(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const variablePattern = /\{\{(\w+)\}\}/g;
  const variables = [];
  let match;

  while ((match = variablePattern.exec(text)) !== null) {
    const variableName = match[1];
    if (!variables.includes(variableName)) {
      variables.push(variableName);
    }
  }

  return variables;
}

// Debug: Log that this module loaded successfully
if (typeof window !== 'undefined') {
  console.log('✅ VariableCatalogue loaded:', Object.keys(VariableCatalogue).length, 'variables');
}

