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
import { parseEmailString } from '@/lib/utils/emailFormat';

/**
 * Variable resolution context with identifiers
 * @typedef {Object} VariableResolutionContext
 * @property {string} [contactId] - Contact identifier (one of these required for CONTACT variables)
 * @property {string} [contactEmail] - Contact email identifier
 * @property {string} [to] - Recipient email field (can be "Name <email>" or just "email") - will be parsed to extract email if contactId/contactEmail missing
 * @property {string} [ownerId] - Owner identifier (for owner/system variables)
 * @property {string} [companyHQId] - Tenant/company context (for same-company snippet logic)
 * @property {Object.<string, *>} [metadata] - Additional metadata for computed values
 */

/** Snippet slugs to omit when contact is at the same company (no "as you may remember" needed) */
const SNIPPETS_TO_OMIT_WHEN_SAME_COMPANY = new Set([
  'as_you_may_remember_softener',
  'as_you_may_remember',
  'as_you_remember',
  'you_may_remember',
]);

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
  // Try to infer contactEmail from 'to' field if contactId/contactEmail not provided
  let contactEmail = context.contactEmail;
  if (!context.contactId && !contactEmail && context.to) {
    try {
      const parsed = parseEmailString(context.to);
      if (parsed.email) {
        contactEmail = parsed.email.toLowerCase().trim();
        console.log(`📧 Inferred contactEmail from 'to' field: ${contactEmail}`);
      }
    } catch (error) {
      console.warn(`Failed to parse email from 'to' field: ${context.to}`, error);
    }
  }

  if (!context.contactId && !contactEmail) {
    console.warn(`Cannot resolve ${variableName}: missing contactId, contactEmail, or valid 'to' field`);
    return '';
  }

  try {
    const definition = VariableCatalogue[variableName];
    if (!definition || !definition.dbField) {
      console.warn(`Unknown contact variable or missing dbField: ${variableName}`);
      return '';
    }

    // Query contact from database
    // Try contactId first, then fall back to email lookup
    let contact = null;
    
    if (context.contactId) {
      try {
        contact = await prisma.contact.findUnique({
          where: { id: context.contactId },
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
      } catch (error) {
        console.warn(`Error looking up contact by ID ${context.contactId}:`, error.message);
        // Fall through to email lookup
      }
    }
    
    // If contactId lookup failed or wasn't provided, try email lookup
    if (!contact && contactEmail) {
      try {
        contact = await prisma.contact.findUnique({
          where: { email: contactEmail },
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
      } catch (error) {
        console.warn(`Error looking up contact by email ${contactEmail}:`, error.message);
      }
    }

    if (!contact) {
      // If contact not found in database, try to extract first name from 'to' field as fallback
      // This allows basic variable resolution for manual entries like "John <john@example.com>"
      if (context.to && variableName === 'firstName') {
        try {
          const parsed = parseEmailString(context.to);
          if (parsed.name) {
            // Extract first name from "Name <email>" format
            const nameParts = parsed.name.trim().split(/\s+/);
            const firstName = nameParts[0];
            if (firstName) {
              console.log(`📝 Extracted firstName from 'to' field: ${firstName}`);
              return firstName;
            }
          }
        } catch (error) {
          console.warn(`Failed to extract name from 'to' field: ${context.to}`, error);
        }
      }
      
      console.warn(`Contact not found: contactId=${context.contactId || 'none'}, email=${contactEmail || 'none'}`);
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
  // Try to infer contactEmail from 'to' field if contactId/contactEmail not provided
  let contactEmail = context.contactEmail;
  if (!context.contactId && !contactEmail && context.to) {
    try {
      const parsed = parseEmailString(context.to);
      if (parsed.email) {
        contactEmail = parsed.email.toLowerCase().trim();
        console.log(`📧 Inferred contactEmail from 'to' field for computed variable: ${contactEmail}`);
      }
    } catch (error) {
      console.warn(`Failed to parse email from 'to' field: ${context.to}`, error);
    }
  }

  if (!context.contactId && !contactEmail) {
    console.warn(`Cannot resolve computed ${variableName}: missing contactId, contactEmail, or valid 'to' field`);
    return '';
  }

  try {
    if (variableName === 'timeSinceConnected') {
      // Need contact's updatedAt to calculate time since
      // Try contactId first, then fall back to email lookup
      let contact = null;
      
      if (context.contactId) {
        try {
          contact = await prisma.contact.findUnique({
            where: { id: context.contactId },
            select: {
              updatedAt: true,
            },
          });
        } catch (error) {
          console.warn(`Error looking up contact by ID ${context.contactId} for computed variable:`, error.message);
        }
      }
      
      // If contactId lookup failed or wasn't provided, try email lookup
      if (!contact && contactEmail) {
        try {
          contact = await prisma.contact.findUnique({
            where: { email: contactEmail },
            select: {
              updatedAt: true,
            },
          });
        } catch (error) {
          console.warn(`Error looking up contact by email ${contactEmail} for computed variable:`, error.message);
        }
      }

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
 * Check if the contact is at the same company as the tenant (so we can soften "as you may remember" language)
 * @param {string} contactId
 * @param {string} companyHQId
 * @returns {Promise<boolean>}
 */
async function isContactSameCompany(contactId, companyHQId) {
  if (!contactId || !companyHQId) return false;
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        contactCompanyId: true,
        companies: {
          select: { companyName: true },
        },
      },
    });
    if (!contact?.contactCompanyId || !contact.companies?.companyName) return false;
    const hq = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
      select: { companyName: true },
    });
    if (!hq?.companyName) return false;
    const norm = (s) => (s || '').toLowerCase().trim();
    return norm(contact.companies.companyName) === norm(hq.companyName);
  } catch {
    return false;
  }
}

const SNIPPET_TAG_REGEX = /\{\{snippet:([^}]+)\}\}/g;

/**
 * Replace {{snippet:slug}} in content with snippet text. When contact is at same company,
 * omit "as you may remember" style snippets so we don't sound redundant.
 * @param {string} content
 * @param {VariableResolutionContext} context
 * @returns {Promise<string>}
 */
async function hydrateSnippetsInContent(content, context) {
  if (!content || typeof content !== 'string') return content || '';
  const matches = [...content.matchAll(SNIPPET_TAG_REGEX)];
  if (matches.length === 0) return content;
  const sameCompany = await isContactSameCompany(context.contactId, context.companyHQId);
  let result = content;
  for (const m of matches) {
    const fullTag = m[0];
    const slug = (m[1] || '').trim();
    if (!slug) continue;
    let text = '';
    if (!sameCompany || !SNIPPETS_TO_OMIT_WHEN_SAME_COMPANY.has(slug)) {
      try {
        const snip = await prisma.contentSnip.findUnique({
          where: { snipSlug: slug },
          select: { snipText: true },
        });
        text = snip?.snipText ?? '';
      } catch {
        text = '';
      }
    }
    result = result.split(fullTag).join(text);
  }
  return result;
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
 * Validate if template has all required variables filled
 * Checks for any remaining {{variable}} tags in hydrated content
 * 
 * @param {string} content - Hydrated content to validate
 * @returns {Object} { valid: boolean, missingVariables: string[] }
 */
export function validateHydration(content) {
  if (!content) return { valid: true, missingVariables: [] };
  
  const variableRegex = /\{\{(\w+)\}\}/g;
  const matches = [...content.matchAll(variableRegex)];
  const missingVariables = matches.map(m => m[1]);
  
  return {
    valid: missingVariables.length === 0,
    missingVariables: Array.from(new Set(missingVariables)),
  };
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

  // Step 1: Replace {{snippet:slug}} (same-company aware: omit "as you may remember" when contact is at our company)
  let afterSnippets = await hydrateSnippetsInContent(templateBody, context);

  // Step 2: Extract and replace {{variableName}}
  const variableNames = extractVariableNames(afterSnippets);

  if (variableNames.length === 0) {
    return afterSnippets;
  }

  const contextWithMetadata = { ...context, metadata };
  const resolvedValues = await resolveVariablesFromDatabase(variableNames, contextWithMetadata);

  let hydrated = afterSnippets;
  variableNames.forEach((variableName) => {
    let value = resolvedValues[variableName] || '';
    if (metadata[variableName] !== undefined) {
      value = metadata[variableName];
    }
    const regex = new RegExp(`\\{\\{${variableName}\\}\\}`, 'g');
    hydrated = hydrated.replace(regex, value);
  });

  return hydrated;
}

