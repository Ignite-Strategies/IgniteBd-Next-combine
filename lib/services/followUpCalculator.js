/**
 * FOLLOW-UP CALCULATOR SERVICE
 * Calculates when the next follow-up email should be sent based on:
 * - Last send date (from email_activities only; platform + off-platform)
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
 * Single source: email_activities (platform + off-platform). Send date = sentAt ?? createdAt.
 * Also considers Contact.lastContactedAt snap.
 * @param {string} contactId - Contact ID
 * @returns {Promise<Date|null>} - Most recent send date or null if never sent
 */
export async function getLastSendDate(contactId) {
  const dates = [];

  // All sends in single table: event = 'sent' (platform) or source = OFF_PLATFORM
  const activities = await prisma.email_activities.findMany({
    where: {
      contact_id: contactId,
      OR: [
        { event: 'sent' },
        { source: 'OFF_PLATFORM' },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  for (const a of activities) {
    const sendDate = a.sentAt ?? a.createdAt;
    if (sendDate) dates.push(new Date(sendDate));
  }

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { lastContactedAt: true },
  });
  if (contact?.lastContactedAt) dates.push(new Date(contact.lastContactedAt));

  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map(d => d.getTime())));
}

/**
 * Calculate the next send date for a contact
 * Respects: doNotContactAgain (no next), manual nextContactedAt (e.g. follow next quarter), else cadence
 * @param {string} contactId - Contact ID
 * @param {Object} config - Optional custom cadence config
 * @returns {Promise<{nextSendDate: Date|null, lastSendDate: Date|null, daysUntilDue: number|null, relationship: string|null, cadenceDays: number|null, isManualOverride: boolean, doNotContactAgain: boolean, nextContactNote: string|null}>}
 */
const ENGAGEMENT_DAYS_DEFAULT = 7; // 7 days from send or from appreciative response

export async function calculateNextSendDate(contactId, config = {}) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      prior_relationship: true,
      doNotContactAgain: true,
      nextContactedAt: true,
      nextContactNote: true,
      nextEngagementDate: true,
      nextEngagementPurpose: true,
      remindMeOn: true,
    },
  });

  if (!contact) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  const lastSendDate = await getLastSendDate(contactId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toDays = (d) => Math.floor((new Date(d) - today) / (1000 * 60 * 60 * 24));

  // Do not contact again → no next follow-up
  if (contact.doNotContactAgain) {
    return {
      nextSendDate: null,
      lastSendDate,
      daysUntilDue: null,
      relationship: contact.prior_relationship,
      cadenceDays: null,
      isManualOverride: true,
      doNotContactAgain: true,
      nextContactNote: contact.nextContactNote ?? null,
    };
  }

  // 1) Stored next engagement (CRM: set by user or by system when recording response)
  const storedDate = contact.nextEngagementDate ?? contact.remindMeOn ?? contact.nextContactedAt;
  if (storedDate) {
    const nextDate = new Date(storedDate);
    nextDate.setHours(0, 0, 0, 0);
    return {
      nextSendDate: new Date(storedDate),
      lastSendDate,
      daysUntilDue: toDays(storedDate),
      relationship: contact.prior_relationship,
      cadenceDays: null,
      isManualOverride: true,
      doNotContactAgain: false,
      nextContactNote: contact.nextContactNote ?? null,
    };
  }

  // No last send → no computed next
  if (!lastSendDate) {
    return {
      nextSendDate: null,
      lastSendDate: null,
      daysUntilDue: null,
      relationship: contact.prior_relationship,
      cadenceDays: null,
      isManualOverride: false,
      doNotContactAgain: false,
      nextContactNote: null,
    };
  }

  // 2) Computed: any response stops auto-calc unless contactAppreciative ("great / let me look into this") → 7d from that response
  const lastSendActivities = await prisma.email_activities.findMany({
    where: {
      contact_id: contactId,
      OR: [{ event: 'sent' }, { source: 'OFF_PLATFORM' }],
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { hasResponded: true, respondedAt: true, contactAppreciative: true },
  });
  const lastSendRow = lastSendActivities[0];
  if (lastSendRow?.hasResponded && lastSendRow.respondedAt) {
    if (lastSendRow.contactAppreciative === true) {
      const nextFromResponse = new Date(lastSendRow.respondedAt);
      nextFromResponse.setDate(nextFromResponse.getDate() + ENGAGEMENT_DAYS_DEFAULT);
      nextFromResponse.setHours(0, 0, 0, 0);
      const daysUntilDue = toDays(nextFromResponse);
      return {
        nextSendDate: nextFromResponse,
        lastSendDate,
        daysUntilDue,
        relationship: contact.prior_relationship,
        cadenceDays: ENGAGEMENT_DAYS_DEFAULT,
        isManualOverride: false,
        doNotContactAgain: false,
        nextContactNote: null,
      };
    }
    // Response but not appreciative → no auto next (response stopped the calculator)
    return {
      nextSendDate: null,
      lastSendDate,
      daysUntilDue: null,
      relationship: contact.prior_relationship,
      cadenceDays: null,
      isManualOverride: false,
      doNotContactAgain: false,
      nextContactNote: null,
    };
  }

  // 3) No response yet → cadence from relationship (e.g. COLD 7d)
  const relationship = contact.prior_relationship || RelationshipEnum.COLD;
  const configKeyMap = {
    [RelationshipEnum.COLD]: 'coldFollowUpDays',
    [RelationshipEnum.WARM]: 'warmFollowUpDays',
    [RelationshipEnum.ESTABLISHED]: 'establishedFollowUpDays',
    [RelationshipEnum.DORMANT]: 'dormantFollowUpDays',
  };
  const configKey = configKeyMap[relationship] || 'coldFollowUpDays';
  const cadenceDays = config[configKey] ?? DEFAULT_CADENCE[relationship] ?? ENGAGEMENT_DAYS_DEFAULT;
  const nextSendDate = new Date(lastSendDate);
  nextSendDate.setDate(nextSendDate.getDate() + cadenceDays);
  nextSendDate.setHours(0, 0, 0, 0);
  const daysUntilDue = toDays(nextSendDate);

  return {
    nextSendDate,
    lastSendDate,
    daysUntilDue,
    relationship,
    cadenceDays,
    isManualOverride: false,
    doNotContactAgain: false,
    nextContactNote: null,
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

/**
 * Snap lastContactedAt on Contact when we log a send (emails or off-platform).
 * Only updates if the given date is after current lastContactedAt.
 * @param {string} contactId - Contact ID
 * @param {Date} sendDate - Date of the send
 * @returns {Promise<{ updated: boolean }>}
 */
export async function snapContactLastContactedAt(contactId, sendDate) {
  if (!contactId || !sendDate) return { updated: false };
  const date = new Date(sendDate);
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { lastContactedAt: true },
  });
  if (!contact) return { updated: false };
  if (contact.lastContactedAt && new Date(contact.lastContactedAt) >= date) return { updated: false };
  await prisma.contact.update({
    where: { id: contactId },
    data: { lastContactedAt: date },
  });
  return { updated: true };
}
