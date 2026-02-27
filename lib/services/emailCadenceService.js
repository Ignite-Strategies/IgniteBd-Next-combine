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
 * DATE-ONLY: nextEngagementDate is stored as "YYYY-MM-DD". We add days in calendar-day space and compare
 * date strings to avoid timezone drift (no DateTime, no midnight UTC/EST confusion).
 */

import { prisma } from '../prisma.js';

/** Hardcoded cadence (days). Future: replace with sequence tuner (pipeline/stage/sequence-aware). */
const AUTO_CADENCE_DAYS = 7;

/** Today as YYYY-MM-DD (UTC calendar date for consistent server comparison). */
function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

/** Date-only string from Date (UTC calendar day). */
function toDateOnlyString(d) {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

/** Add n calendar days to a YYYY-MM-DD string; returns YYYY-MM-DD. */
function addDaysToDateString(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Day difference: dateStrA - dateStrB in days (for daysUntilDue). */
function dayDiff(dateStrA, dateStrB) {
  const a = new Date(dateStrA + 'T12:00:00.000Z').getTime();
  const b = new Date(dateStrB + 'T12:00:00.000Z').getTime();
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

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
  const todayStr = getTodayString();

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

  // Stored date wins (don't move the date). nextEngagementDate is YYYY-MM-DD; remindMeOn/nextContactedAt we convert to date-only.
  const storedDateStr =
    contact.nextEngagementDate ??
    (contact.remindMeOn ? toDateOnlyString(contact.remindMeOn) : null) ??
    (contact.nextContactedAt ? toDateOnlyString(contact.nextContactedAt) : null);
  if (storedDateStr) {
    const userSetDate = !!(contact.remindMeOn ?? contact.nextContactedAt);
    return {
      nextSendDate: storedDateStr,
      lastSendDate,
      daysUntilDue: dayDiff(storedDateStr, todayStr),
      relationship: contact.prior_relationship,
      cadenceDays: null,
      isManualOverride: true,
      doNotContactAgain: false,
      nextContactNote: contact.nextContactNote ?? null,
      nextEngagementPurpose: userSetDate ? 'UNRESPONSIVE' : null,
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

  // Did contact respond after our last send? (responseFromEmail → that row's sentAt)
  const lastSendRow = await prisma.email_activities.findFirst({
    where: {
      contact_id: contactId,
      OR: [{ event: 'sent' }, { source: 'OFF_PLATFORM' }],
    },
    orderBy: { createdAt: 'desc' },
    select: { responseFromEmail: true },
  });

  let respondedAt = null;
  if (lastSendRow?.responseFromEmail) {
    const respRow = await prisma.email_activities.findUnique({
      where: { id: lastSendRow.responseFromEmail },
      select: { sentAt: true },
    });
    respondedAt = respRow?.sentAt ?? null;
  }
  const respondedAfterLastSend = !!respondedAt;

  if (!respondedAfterLastSend) {
    // 1. Don't respond → auto +7 calendar days from last send date (date-only, no timestamp).
    const lastSendDateStr = toDateOnlyString(lastSendDate);
    const nextSendDateStr = addDaysToDateString(lastSendDateStr, AUTO_CADENCE_DAYS);
    return {
      nextSendDate: nextSendDateStr,
      lastSendDate,
      daysUntilDue: dayDiff(nextSendDateStr, todayStr),
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
    const fromDate = respondedAt ? new Date(respondedAt) : lastSendDate;
    const fromDateStr = toDateOnlyString(fromDate);
    const nextSendDateStr = addDaysToDateString(fromDateStr, AUTO_CADENCE_DAYS);
    return {
      nextSendDate: nextSendDateStr,
      lastSendDate,
      daysUntilDue: dayDiff(nextSendDateStr, todayStr),
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
 * nextEngagementDate is stored as date-only string "YYYY-MM-DD".
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
    const purpose = result.nextEngagementPurpose ?? (result.isManualOverride ? null : 'UNRESPONSIVE');
    const data = { nextEngagementDate: result.nextSendDate };
    if (purpose != null) data.nextEngagementPurpose = purpose;
    await prisma.contact.update({
      where: { id: contactId },
      data,
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
  return result.nextSendDate != null && result.daysUntilDue <= 0;
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
