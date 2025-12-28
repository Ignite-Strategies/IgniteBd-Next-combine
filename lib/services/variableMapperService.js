/**
 * Variable Mapper Service
 * 
 * Maps variable names to database queries and resolves values from the database.
 * 
 * This service allows variables like {{firstName}} to automatically query the database
 * to get the contact's first name, rather than requiring data to be passed in context.
 */

import { prisma } from '@/lib/prisma';
import { calculateTimeSince } from '@/lib/templateVariables';

/**
 * Variable resolution context with identifiers
 * @typedef {Object} VariableResolutionContext
 * @property {string} [contactId] - Contact identifier (one of these required for CONTACT variables)
 * @property {string} [contactEmail] - Contact email identifier
 * @property {string} [ownerId] - Owner identifier (for owner/system variables)
 * @property {Object.<string, *>} [metadata] - Additional metadata for computed values
 */

/**
 * Variable source types
 * @typedef {'CONTACT' | 'OWNER' | 'COMPUTED'} VariableSource
 */

/**
 * Variable definition
 * @typedef {Object} VariableDefinition
 * @property {string} key - Variable key
 * @property {VariableSource} source - Variable source type
 * @property {string} [description] - Variable description
 * @property {string} [dbField] - Database field path (e.g., "firstName", "companyName")
 * @property {boolean} [computed] - If true, value is computed rather than from DB
 */

/**
 * Variable catalogue - maps variable names to their definitions
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
 * Resolve a CONTACT variable from the database
 */
async function resolveContactVariable(
  variableName,
  context
) {
  if (!context.contactId && !context.contactEmail) {
    console.warn(`Cannot resolve ${variableName}: missing contactId or contactEmail`);
    return '';
  }

  try {
    const definition = VariableCatalogue[variableName];
    if (!definition || !definition.dbField) {
      console.warn(`Unknown contact variable or missing dbField: ${variableName}`);
      return '';
    }

    // Query contact from database
    const contact = await prisma.contact.findUnique({
      where: context.contactId
        ? { id: context.contactId }
        : { email: context.contactEmail },
      select: {
        firstName: true,
        lastName: true,
        fullName: true,
        goesBy: true,
        email: true,
        title: true,
        companyName: true,
        companyDomain: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    if (!contact) {
      console.warn(`Contact not found: ${context.contactId || context.contactEmail}`);
      return '';
    }

    // Handle special cases
    if (variableName === 'fullName') {
      // Use fullName if available, otherwise compute from firstName + lastName
      if (contact.fullName) return contact.fullName;
      const first = contact.firstName || '';
      const last = contact.lastName || '';
      return `${first} ${last}`.trim() || '';
    }

    // Get value from contact object
    const value = contact[definition.dbField];
    return value || '';
  } catch (error) {
    console.error(`Error resolving contact variable ${variableName}:`, error);
    return '';
  }
}

/**
 * Resolve a COMPUTED variable (derived from contact data)
 */
async function resolveComputedVariable(
  variableName,
  context
) {
  if (!context.contactId && !context.contactEmail) {
    console.warn(`Cannot resolve computed ${variableName}: missing contactId or contactEmail`);
    return '';
  }

  try {
    if (variableName === 'timeSinceConnected') {
      // Need contact's updatedAt to calculate time since
      const contact = await prisma.contact.findUnique({
        where: context.contactId
          ? { id: context.contactId }
          : { email: context.contactEmail },
        select: {
          updatedAt: true,
        },
      });

      if (!contact) {
        return 'a while';
      }

      return calculateTimeSince(contact.updatedAt);
    }

    // Add other computed variables here as needed
    console.warn(`Unknown computed variable: ${variableName}`);
    return '';
  } catch (error) {
    console.error(`Error resolving computed variable ${variableName}:`, error);
    return '';
  }
}

/**
 * Resolve a variable by querying the database
 * 
 * @param {string} variableName - The variable name (e.g., "firstName")
 * @param {VariableResolutionContext} context - Context with identifiers
 * @returns {Promise<string>} The resolved value from the database
 */
export async function resolveVariableFromDatabase(variableName, context) {
  const definition = VariableCatalogue[variableName];
  if (!definition) {
    console.warn(`Unknown variable: ${variableName}`);
    return '';
  }

  // Route to appropriate resolver based on source
  switch (definition.source) {
    case 'CONTACT':
      return resolveContactVariable(variableName, context);
    case 'COMPUTED':
      return resolveComputedVariable(variableName, context);
    default:
      console.warn(`Unknown variable source: ${definition.source}`);
      return '';
  }
}

/**
 * Resolve multiple variables in batch (more efficient)
 * 
 * @param {string[]} variableNames - Array of variable names to resolve
 * @param {VariableResolutionContext} context - Context with identifiers
 * @returns {Promise<Record<string, string>>} Map of variable names to resolved values
 */
export async function resolveVariablesFromDatabase(variableNames, context) {
  const results = {};

  // Resolve all variables
  // TODO: Can be optimized with batch queries in the future
  for (const variableName of variableNames) {
    results[variableName] = await resolveVariableFromDatabase(variableName, context);
  }

  return results;
}

/**
 * Extract variable names from template content
 * 
 * @param {string} template - Template content with {{variableName}} tags
 * @returns {string[]} Array of unique variable names
 */
export function extractVariableNames(template) {
  if (!template) return [];
  const variableRegex = /\{\{(\w+)\}\}/g;
  const matches = [...template.matchAll(variableRegex)];
  return Array.from(new Set(matches.map(m => m[1])));
}

/**
 * Hydrate template content with variables resolved from database
 * 
 * @param {string} templateBody - Template content with {{variables}}
 * @param {VariableResolutionContext} context - Context with identifiers for database queries
 * @param {Record<string, any>} metadata - Additional metadata for computed variables (timeHorizon, etc.)
 * @returns {Promise<string>} Hydrated template with variables replaced
 */
export async function hydrateTemplateFromDatabase(templateBody, context, metadata = {}) {
  if (!templateBody) return '';

  // Extract all variables from template
  const variableNames = extractVariableNames(templateBody);

  if (variableNames.length === 0) {
    // No variables, return as-is
    return templateBody;
  }

  // Add metadata to context for computed variables
  const contextWithMetadata = { ...context, metadata };

  // Resolve all variables from database
  const resolvedValues = await resolveVariablesFromDatabase(variableNames, contextWithMetadata);

  // Replace variables in template
  let hydrated = templateBody;
  variableNames.forEach((variableName) => {
    let value = resolvedValues[variableName] || '';
    
    // Handle metadata for variables that need it (e.g., timeHorizon from metadata)
    if (metadata[variableName] !== undefined) {
      value = metadata[variableName];
    }

    const regex = new RegExp(`\\{\\{${variableName}\\}\\}`, 'g');
    hydrated = hydrated.replace(regex, value);
  });

  return hydrated;
}

