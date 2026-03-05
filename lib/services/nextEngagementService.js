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
 * @returns {Promise<Array<{ contactId, firstName, lastName, email, nextEngagementDate, nextEngagementPurpose, lastEngagementDate, lastEngagementType }>>}
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
      title: true,
      company: true,
      nextEngagementDate: true,
      nextEngagementPurpose: true,
      nextContactNote: true,
      lastEngagementDate: true,
      lastEngagementType: true,
      pipelineSnap: true,
      pipelineStageSnap: true,
      email_activities: {
        where: { summary: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { summary: true, sentAt: true, createdAt: true },
      },
    },
  });

  return contacts.map((c) => {
    const lastActivity = c.email_activities?.[0] || null;
    return {
      contactId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      goesBy: c.goesBy,
      title: c.title ?? null,
      company: c.company ?? null,
      nextEngagementDate: c.nextEngagementDate ?? null,
      nextEngagementPurpose: c.nextEngagementPurpose ?? null,
      nextContactNote: c.nextContactNote ?? null,
      lastEngagementDate: c.lastEngagementDate ? c.lastEngagementDate.toISOString() : null,
      lastEngagementType: c.lastEngagementType ?? null,
      pipeline: c.pipelineSnap ?? null,
      stage: c.pipelineStageSnap ?? null,
      lastSummary: lastActivity?.summary ?? null,
    };
  });
}
