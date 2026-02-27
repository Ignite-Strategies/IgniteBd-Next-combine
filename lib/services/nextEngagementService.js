/**
 * NEXT ENGAGEMENT SERVICE
 * Single source of truth: Contact.nextEngagementDate.
 * Fetches only — no compute. Cadence service computes and persists; this service returns contacts by next engagement.
 * Frontend can bucket: "Happening today", "In 7 days", "Next month", etc.
 */

import { prisma } from '../prisma.js';

/**
 * Get all contacts for a company that have a next engagement date set.
 * Returns full list; frontend parses/buckets by date (today, in 7 days, next month).
 * @param {string} companyHQId - Company HQ ID (contacts.crmId)
 * @param {Object} options - { limit?: number }
 * @returns {Promise<Array<{ contactId, firstName, lastName, email, nextEngagementDate, nextEngagementPurpose, lastContactedAt }>>}
 */
export async function getContactsWithNextEngagement(companyHQId, options = {}) {
  const { limit = 500 } = options;

  const contacts = await prisma.contact.findMany({
    where: {
      crmId: companyHQId,
      doNotContactAgain: false,
      nextEngagementDate: { not: null },
    },
    orderBy: { nextEngagementDate: 'asc' },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      goesBy: true,
      nextEngagementDate: true,
      nextEngagementPurpose: true,
      nextContactNote: true,
      lastContactedAt: true,
      lastRespondedAt: true,
    },
  });

  return contacts.map((c) => ({
    contactId: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    goesBy: c.goesBy,
    nextEngagementDate: c.nextEngagementDate ?? null, // already "YYYY-MM-DD"
    nextEngagementPurpose: c.nextEngagementPurpose ?? null,
    nextContactNote: c.nextContactNote ?? null,
    lastContactedAt: c.lastContactedAt ? c.lastContactedAt.toISOString() : null,
    lastRespondedAt: c.lastRespondedAt ? c.lastRespondedAt.toISOString() : null,
  }));
}
