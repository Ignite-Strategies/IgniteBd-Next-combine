/**
 * FOLLOW-UP CALCULATOR SERVICE
 * Calculates when the next follow-up email should be sent based on:
 * - Last send date (from email_activities OR off_platform_email_sends)
 * - Contact's prior_relationship (COLD, WARM, ESTABLISHED, DORMANT)
 * - Configurable follow-up cadence rules
 */

import { prisma } from '../prisma.js';
import { RelationshipEnum } from '@prisma/client';

/**
 * Default follow-up cadence (in days) based on relationship type
 */
const DEFAULT_CADENCE = {
  [RelationshipEnum.COLD]: 7,
  [RelationshipEnum.WARM]: 3,
  [RelationshipEnum.ESTABLISHED]: 14,
  [RelationshipEnum.DORMANT]: 30,
};

/**
 * Get the most recent email send date for a contact
 * Checks both email_activities (platform) and off_platform_email_sends
 * @param {string} contactId - Contact ID
 * @returns {Promise<Date|null>} - Most recent send date or null if never sent
 */
export async function getLastSendDate(contactId) {
  // Get most recent platform send
  const platformSend = await prisma.email_activities.findFirst({
    where: {
      contact_id: contactId,
      event: 'sent', // Only count actual sends, not other events
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Get most recent off-platform send
  const offPlatformSend = await prisma.off_platform_email_sends.findFirst({
    where: {
      contactId: contactId,
    },
    orderBy: {
      emailSent: 'desc',
    },
  });

  // Return the most recent date
  const dates = [];
  if (platformSend?.createdAt) dates.push(new Date(platformSend.createdAt));
  if (offPlatformSend?.emailSent) dates.push(new Date(offPlatformSend.emailSent));

  if (dates.length === 0) return null;

  return new Date(Math.max(...dates.map(d => d.getTime())));
}

/**
 * Calculate the next send date for a contact
 * @param {string} contactId - Contact ID
 * @param {Object} config - Optional custom cadence config
 * @param {number} [config.coldFollowUpDays] - Days for COLD relationship
 * @param {number} [config.warmFollowUpDays] - Days for WARM relationship
 * @param {number} [config.establishedFollowUpDays] - Days for ESTABLISHED relationship
 * @param {number} [config.dormantFollowUpDays] - Days for DORMANT relationship
 * @returns {Promise<{nextSendDate: Date|null, lastSendDate: Date|null, daysUntilDue: number|null, relationship: string|null, cadenceDays: number}>}
 */
export async function calculateNextSendDate(contactId, config = {}) {
  // Get contact with relationship info
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      prior_relationship: true,
    },
  });

  if (!contact) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  // Get last send date
  const lastSendDate = await getLastSendDate(contactId);

  // If never sent, return null (no follow-up needed yet)
  if (!lastSendDate) {
    return {
      nextSendDate: null,
      lastSendDate: null,
      daysUntilDue: null,
      relationship: contact.prior_relationship,
      cadenceDays: null,
    };
  }

  // Determine cadence based on relationship
  const relationship = contact.prior_relationship || RelationshipEnum.COLD;
  
  // Map relationship to config key
  const configKeyMap = {
    [RelationshipEnum.COLD]: 'coldFollowUpDays',
    [RelationshipEnum.WARM]: 'warmFollowUpDays',
    [RelationshipEnum.ESTABLISHED]: 'establishedFollowUpDays',
    [RelationshipEnum.DORMANT]: 'dormantFollowUpDays',
  };
  
  const configKey = configKeyMap[relationship] || 'coldFollowUpDays';
  const cadenceDays = config[configKey] || 
                      DEFAULT_CADENCE[relationship] || 
                      DEFAULT_CADENCE[RelationshipEnum.COLD];

  // Calculate next send date
  const nextSendDate = new Date(lastSendDate);
  nextSendDate.setDate(nextSendDate.getDate() + cadenceDays);

  // Calculate days until due (negative if overdue)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(nextSendDate);
  nextDate.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.floor((nextDate - today) / (1000 * 60 * 60 * 24));

  return {
    nextSendDate,
    lastSendDate,
    daysUntilDue,
    relationship,
    cadenceDays,
  };
}

/**
 * Check if a contact is due for follow-up
 * @param {string} contactId - Contact ID
 * @param {Object} config - Optional custom cadence config
 * @returns {Promise<boolean>} - True if due for follow-up
 */
export async function isDueForFollowUp(contactId, config = {}) {
  const result = await calculateNextSendDate(contactId, config);
  return result.nextSendDate !== null && result.daysUntilDue <= 0;
}
