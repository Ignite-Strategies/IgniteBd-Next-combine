/**
 * Variable Catalogue - CLIENT-SAFE
 * 
 * Client-safe exports for variable catalogue and utilities.
 * This file does NOT import prisma or any server-side dependencies.
 */

'use client';

/**
 * Variable catalogue - maps variable names to their definitions
 * This is a static object, safe for client-side use.
 *
 * Sources:
 *   CONTACT  — resolved from the Contact record (recipient)
 *   OWNER    — resolved from the owner profile + companyHQ (sender / "your company")
 *   COMPUTED — derived/calculated values
 */
export const VariableCatalogue = {
  // ── CONTACT variables (recipient) ───────────────────────────────────────────
  firstName:    { key: 'firstName',    source: 'CONTACT',  description: "Recipient's first name",                   dbField: 'firstName',              example: 'John' },
  lastName:     { key: 'lastName',     source: 'CONTACT',  description: "Recipient's last name",                    dbField: 'lastName',               example: 'Smith' },
  fullName:     { key: 'fullName',     source: 'CONTACT',  description: "Recipient's full name",                    dbField: 'fullName',               example: 'John Smith' },
  goesBy:       { key: 'goesBy',       source: 'CONTACT',  description: "Name recipient prefers to be called",      dbField: 'goesBy',                 example: 'Johnny' },
  companyName:  { key: 'companyName',  source: 'CONTACT',  description: "Recipient's current company",              dbField: 'companyName',            example: 'Acme Capital' },
  title:        { key: 'title',        source: 'CONTACT',  description: "Recipient's job title",                    dbField: 'title',                  example: 'Managing Director' },
  email:        { key: 'email',        source: 'CONTACT',  description: "Recipient's email address",                dbField: 'email',                  example: 'john@acmecapital.com' },
  // ── OWNER variables (sender / your company) ──────────────────────────────────
  senderName:      { key: 'senderName',      source: 'OWNER', description: "Sender's first name",                       dbField: 'firstName',              example: 'Adam' },
  senderFullName:  { key: 'senderFullName',  source: 'OWNER', description: "Sender's full name",                        dbField: 'name',                   example: 'Adam Cole' },
  senderEmail:     { key: 'senderEmail',     source: 'OWNER', description: "Sender's verified email",                   dbField: 'sendgridVerifiedEmail',  example: 'adam@bpl.com' },
  senderCompany:   { key: 'senderCompany',   source: 'OWNER', description: "Your company (from companyHQId)",            dbField: 'companyName',            example: 'BPL' },
  // ── COMPUTED variables ───────────────────────────────────────────────────────
  timeSinceConnected: { key: 'timeSinceConnected', source: 'COMPUTED', description: "Time since last contact", computed: true, example: '2 years' },
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

