/**
 * EMAIL CADENCE SERVICE
 * Two-fold:
 * (a) Sequence order — contact must respond: we look at whether they responded after our last send.
 * (b) Pipeline is source of truth — determines next send.
 *
 * Rules we're solving for:
 * 1. If don't respond (after last send) → auto 7 days.
 * 2. If do respond → check where they landed: connector + forwarded (but not introduction-made) → 7 days.
 *
 * Cadence: hardcoded for now; see where we land. Future: sequence tuner (per pipeline/stage/sequence config).
 */

import { prisma } from '../prisma.js';

/** Hardcoded cadence (days). Future: replace with sequence tuner (pipeline/stage/sequence-aware). */
const AUTO_CADENCE_DAYS = 7;

/**
 * Get the most recent email send date for a contact.
 * Send = event 'sent' or source OFF_PLATFORM with sentAt; uses sentAt ?? createdAt.
 */
export async function getLastSendDate(contactId) {
  const dates = [];

  const activities = await prisma.email_activities.findMany({
    where: {
      contact_id: contactId,
      OR: [{ event: 'sent' }, { source: 'OFF_PLATFORM' }],
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
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

/**
 * Calculate next send date. Pipeline is source of truth.
 * - Stored date (remindMeOn / nextContactedAt; after migration also nextEngagementDate) wins when set.
 * - No response after last send → auto 7 days.
 * - Responded + connector + forwarded (not introduction-made) → 7 days.
 * - Responded + other pipeline/stage → no auto next.
 *
 * Pre-migration safe: we only select columns that exist before the next-engagement migration
 * (no nextEngagementDate / contactDisposition). After running the migration, add those to select
 * and use nextEngagementDate ?? remindMeOn ?? nextContactedAt for storedDate.
 */
export async function calculateNextSendDate(contactId, config = {}) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      doNotContactAgain: true,
      nextContactedAt: true,
      nextEngagementDate: true,
      nextContactNote: true,
      remindMeOn: true,
      prior_relationship: true,
      pipelineSnap: true,
      pipelineStageSnap: true,
    },
  });

  if (!contact) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  const lastSendDate = await getLastSendDate(contactId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toDays = (d) => Math.floor((new Date(d) - today) / (1000 * 60 * 60 * 24));

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

  const storedDate = contact.nextEngagementDate ?? contact.remindMeOn ?? contact.nextContactedAt;
  if (storedDate) {
    return {
      nextSendDate: new Date(storedDate),
      lastSendDate,
      daysUntilDue: toDays(storedDate),
      relationship: contact.prior_relationship,
      cadenceDays: null,
      isManualOverride: true,
      doNotContactAgain: false,
      nextContactNote: contact.nextContactNote ?? null,
      nextEngagementPurpose: 'GENERAL_CHECK_IN',
    };
  }

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

  // Sequence order: did contact respond after our last send?
  const lastSendRow = await prisma.email_activities.findFirst({
    where: {
      contact_id: contactId,
      OR: [{ event: 'sent' }, { source: 'OFF_PLATFORM' }],
    },
    orderBy: { createdAt: 'desc' },
    select: { hasResponded: true, respondedAt: true },
  });

  const respondedAfterLastSend = lastSendRow?.hasResponded === true && lastSendRow?.respondedAt;

  if (!respondedAfterLastSend) {
    // 1. Don't respond → auto 7 days (use UTC so year/day don't flip by server TZ)
    const nextSendDate = new Date(lastSendDate);
    nextSendDate.setUTCDate(nextSendDate.getUTCDate() + AUTO_CADENCE_DAYS);
    nextSendDate.setUTCHours(0, 0, 0, 0);
    return {
      nextSendDate,
      lastSendDate,
      daysUntilDue: toDays(nextSendDate),
      relationship: contact.prior_relationship,
      cadenceDays: AUTO_CADENCE_DAYS,
      isManualOverride: false,
      doNotContactAgain: false,
      nextContactNote: null,
      nextEngagementPurpose: 'UNRESPONSIVE',
    };
  }

  // 2. Do respond → check pipeline (from snap on contact): connector + forwarded → 7 days
  const pipelineName = contact.pipelineSnap ?? null;
  const pipelineStage = contact.pipelineStageSnap ?? null;

  if (
    pipelineName === 'connector' &&
    pipelineStage === 'forwarded'
  ) {
    const fromDate = lastSendRow.respondedAt ? new Date(lastSendRow.respondedAt) : lastSendDate;
    const nextSendDate = new Date(fromDate);
    nextSendDate.setUTCDate(nextSendDate.getUTCDate() + AUTO_CADENCE_DAYS);
    nextSendDate.setUTCHours(0, 0, 0, 0);
    return {
      nextSendDate,
      lastSendDate,
      daysUntilDue: toDays(nextSendDate),
      relationship: contact.prior_relationship,
      cadenceDays: AUTO_CADENCE_DAYS,
      isManualOverride: false,
      doNotContactAgain: false,
      nextContactNote: null,
      nextEngagementPurpose: 'PERIODIC_CHECK_IN',
    };
  }

  // Responded but not in connector/forwarded → no auto next
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

/**
 * Compute next send date and persist to Contact.nextEngagementDate (and nextEngagementPurpose).
 * Call after send, after response, or from recalculate. No-op if column doesn't exist (e.g. pre-migration).
 */
export async function computeAndPersistNextEngagement(contactId) {
  try {
    const result = await calculateNextSendDate(contactId);
    if (result.nextSendDate == null) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          nextEngagementDate: null,
          nextEngagementPurpose: null,
        },
      });
      return { updated: true, nextEngagementDate: null };
    }
    const purpose = result.nextEngagementPurpose ?? (result.isManualOverride ? 'GENERAL_CHECK_IN' : 'UNRESPONSIVE');
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        nextEngagementDate: result.nextSendDate,
        nextEngagementPurpose: purpose,
      },
    });
    return { updated: true, nextEngagementDate: result.nextSendDate };
  } catch (e) {
    if (e?.code === 'P2022' || e?.message?.includes('nextEngagementDate')) {
      return { updated: false };
    }
    throw e;
  }
}

export async function isDueForFollowUp(contactId, config = {}) {
  const result = await calculateNextSendDate(contactId, config);
  return result.nextSendDate !== null && result.daysUntilDue <= 0;
}

/**
 * Snap lastContactedAt on Contact when we log a send.
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
