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
      contactDisposition: { not: 'OPTED_OUT' },
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
      companyName: true,
      companies: { select: { companyName: true } },
      nextEngagementDate: true,
      nextEngagementPurpose: true,
      nextContactNote: true,
      lastEngagementDate: true,
      lastEngagementType: true,
      pipelineSnap: true,
      pipelineStageSnap: true,
      engagementSummary: true,
    },
  });

  return contacts.map((c) => {
    return {
      contactId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      goesBy: c.goesBy,
      title: c.title ?? null,
      company: c.companyName || c.companies?.companyName || null,
      nextEngagementDate: c.nextEngagementDate ?? null,
      nextEngagementPurpose: c.nextEngagementPurpose ?? null,
      nextContactNote: c.nextContactNote ?? null,
      lastEngagementDate: c.lastEngagementDate ? c.lastEngagementDate.toISOString() : null,
      lastEngagementType: c.lastEngagementType ?? null,
      pipeline: c.pipelineSnap ?? null,
      stage: c.pipelineStageSnap ?? null,
      engagementSummary: c.engagementSummary ?? null,
    };
  });
}
