/**
 * ENGAGEMENT SERVICE
 *
 * Universal source of truth for contact engagement timing.
 * Channel-agnostic — has nothing to do with email specifically.
 *
 * Contact fields used:
 *   lastEngagementDate  DateTime?         — most recent interaction (any type)
 *   lastEngagementType  EngagementType?   — OUTBOUND_EMAIL | CONTACT_RESPONSE | MEETING | MANUAL
 *   nextEngagementDate  String?           — "YYYY-MM-DD" next touch date
 *   contactDisposition  ContactDisposition? — drives cadence frequency; OPTED_OUT = hard gate
 *
 * Disposition → cadence days:
 *   ADVOCATE / WARM / NEUTRAL / null  →  7 days  (AI-inferred preferred)
 *   WARM_WRONG_CONTACT                → 90 days  (quarterly — nurture for intro)
 *   WARM_NO_NEED / COOLING            → 180 days (semi-annual — back off)
 *   OPTED_OUT                         → null     (hard gate — clear nextEngagementDate)
 *
 * Exports (canonical names):
 *   stampEngagement(contactId, date, type)     — record that something happened
 *   getLastEngagement(contactId)               — read lastEngagementDate
 *   getNextEngagement(contactId)               — read next date, rules only, no persist
 *   computeNextEngagement(contactId)           — AI-infer + persist next date
 *   listContactsDue(companyHQId, options)      — all contacts with nextEngagementDate set
 *   isDue(contactId)                           — boolean: is this contact overdue?
 *
 * Legacy aliases (backward compat — same functions, old names):
 *   stampLastEngagement, getLastSendDate, calculateNextSendDate,
 *   computeAndPersistNextEngagement, getContactsWithNextEngagement, isDueForFollowUp
 */

import { prisma } from '../prisma.js';
import { OpenAI } from 'openai';

const DEFAULT_CADENCE_DAYS = 7;

// ─── helpers ────────────────────────────────────────────────────────────────

/** Cadence days by disposition. Returns null for OPTED_OUT (hard gate). */
export function cadenceDaysForDisposition(disposition) {
  switch (disposition) {
    case 'WARM_WRONG_CONTACT': return 90;
    case 'WARM_NO_NEED':
    case 'COOLING':            return 180;
    case 'OPTED_OUT':          return null;
    default:                   return DEFAULT_CADENCE_DAYS;
  }
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function toDateOnlyString(d) {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

function addDaysToDateString(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayDiff(dateStrA, dateStrB) {
  const a = new Date(dateStrA + 'T12:00:00.000Z').getTime();
  const b = new Date(dateStrB + 'T12:00:00.000Z').getTime();
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

/** Use AI to extract a follow-up date from an activity summary. Returns "YYYY-MM-DD" or null. */
async function inferDateFromSummary(summary, todayStr) {
  if (!summary || summary.length < 10) return null;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.1,
      max_tokens: 60,
      messages: [
        {
          role: 'system',
          content: `You determine follow-up dates from CRM activity summaries. Today is ${todayStr}.
Given a summary, extract the implied next follow-up date. Examples:
- "follow up in 3-6 months" → midpoint ~4.5 months from today
- "reach out after Labor Day" → the day after Labor Day
- "call back next quarter" → first business day of next quarter
- "not interested, try again in a year" → 1 year from today
- "deferred to Q3" → July 1 (or next year if Q3 passed)
- "set meeting for March 15" → March 15
- "positive response, scheduling call" → 3 days from today
- "just a general check-in, no timing" → null
Return ONLY: {"date": "YYYY-MM-DD"} or {"date": null}`,
        },
        { role: 'user', content: summary },
      ],
      response_format: { type: 'json_object' },
    });
    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const d = parsed?.date;
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return null;
  } catch (e) {
    console.warn('⚠️ inferDateFromSummary failed:', e?.message);
    return null;
  }
}

// ─── STAMP ───────────────────────────────────────────────────────────────────

/**
 * Record that an engagement happened. Only moves lastEngagementDate forward (never back).
 * @param {string} contactId
 * @param {Date|string} date
 * @param {string} type  — EngagementType: OUTBOUND_EMAIL | CONTACT_RESPONSE | MEETING | MANUAL
 */
export async function stampEngagement(contactId, date, type) {
  if (!contactId || !date) return { updated: false };
  const engagementDate = new Date(date);
  if (isNaN(engagementDate.getTime())) return { updated: false };

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { lastEngagementDate: true },
  });
  if (!contact) return { updated: false };

  if (contact.lastEngagementDate && new Date(contact.lastEngagementDate) >= engagementDate) {
    return { updated: false };
  }

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      lastEngagementDate: engagementDate,
      lastEngagementType: type || 'MANUAL',
    },
  });
  return { updated: true };
}

// ─── READ LAST ───────────────────────────────────────────────────────────────

/**
 * Get the last engagement date for a contact.
 * @returns {Promise<Date|null>}
 */
export async function getLastEngagement(contactId) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { lastEngagementDate: true },
  });
  return contact?.lastEngagementDate ? new Date(contact.lastEngagementDate) : null;
}

// ─── READ NEXT (no persist) ──────────────────────────────────────────────────

/**
 * Calculate when to next engage a contact — rules only, no AI, no DB write.
 * Use for display/preview. Use computeNextEngagement() to actually persist.
 */
export async function getNextEngagement(contactId) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      contactDisposition: true,
      lastEngagementDate: true,
      lastEngagementType: true,
      nextEngagementDate: true,
      nextContactNote: true,
      prior_relationship: true,
    },
  });

  if (!contact) throw new Error(`Contact not found: ${contactId}`);

  const todayStr = getTodayString();
  const cadenceDays = cadenceDaysForDisposition(contact.contactDisposition);

  if (cadenceDays === null) {
    return {
      nextEngagementDate: null,
      lastEngagementDate: contact.lastEngagementDate,
      lastEngagementType: contact.lastEngagementType,
      daysUntilDue: null,
      cadenceDays: null,
      isManualOverride: true,
      optedOut: true,
      contactDisposition: contact.contactDisposition,
      nextContactNote: contact.nextContactNote ?? null,
    };
  }

  if (contact.nextEngagementDate) {
    return {
      nextEngagementDate: contact.nextEngagementDate,
      lastEngagementDate: contact.lastEngagementDate,
      lastEngagementType: contact.lastEngagementType,
      daysUntilDue: dayDiff(contact.nextEngagementDate, todayStr),
      cadenceDays: null,
      isManualOverride: true,
      optedOut: false,
      contactDisposition: contact.contactDisposition,
      nextContactNote: contact.nextContactNote ?? null,
    };
  }

  if (!contact.lastEngagementDate) {
    return {
      nextEngagementDate: null,
      lastEngagementDate: null,
      lastEngagementType: null,
      daysUntilDue: null,
      cadenceDays: null,
      isManualOverride: false,
      optedOut: false,
      contactDisposition: contact.contactDisposition,
      nextContactNote: null,
    };
  }

  const lastStr = toDateOnlyString(contact.lastEngagementDate);
  const nextStr = addDaysToDateString(lastStr, cadenceDays);

  return {
    nextEngagementDate: nextStr,
    lastEngagementDate: contact.lastEngagementDate,
    lastEngagementType: contact.lastEngagementType,
    daysUntilDue: dayDiff(nextStr, todayStr),
    cadenceDays,
    isManualOverride: false,
    optedOut: false,
    contactDisposition: contact.contactDisposition,
    nextContactNote: null,
  };
}

// ─── COMPUTE + PERSIST ───────────────────────────────────────────────────────

/**
 * Compute and persist nextEngagementDate.
 *   1. OPTED_OUT → clear date, return
 *   2. Already set → skip
 *   3. AI-infer from latest activity summary (standard cadence contacts only)
 *   4. Fallback: lastEngagementDate + disposition cadence days
 */
export async function computeNextEngagement(contactId) {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        contactDisposition: true,
        lastEngagementDate: true,
        nextEngagementDate: true,
      },
    });

    if (!contact) return { updated: false, error: 'Contact not found' };

    const cadenceDays = cadenceDaysForDisposition(contact.contactDisposition);

    if (cadenceDays === null) {
      await prisma.contact.update({
        where: { id: contactId },
        data: { nextEngagementDate: null, nextEngagementPurpose: null },
      });
      return { updated: true, nextEngagementDate: null, source: 'opted_out' };
    }

    if (contact.nextEngagementDate) {
      return { updated: false, nextEngagementDate: contact.nextEngagementDate, source: 'already_set' };
    }

    if (!contact.lastEngagementDate) {
      return { updated: false, nextEngagementDate: null, source: 'no_engagement' };
    }

    const todayStr = getTodayString();

    // For standard cadence contacts try AI-inference from latest activity summary
    if (cadenceDays <= DEFAULT_CADENCE_DAYS) {
      const latestActivity = await prisma.email_activities.findFirst({
        where: { contact_id: contactId, summary: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { summary: true },
      });

      if (latestActivity?.summary) {
        const aiDate = await inferDateFromSummary(latestActivity.summary, todayStr);
        if (aiDate) {
          await prisma.contact.update({
            where: { id: contactId },
            data: { nextEngagementDate: aiDate },
          });
          return { updated: true, nextEngagementDate: aiDate, source: 'ai_summary' };
        }
      }
    }

    const lastStr = toDateOnlyString(contact.lastEngagementDate);
    const nextStr = addDaysToDateString(lastStr, cadenceDays);

    await prisma.contact.update({
      where: { id: contactId },
      data: { nextEngagementDate: nextStr },
    });
    return { updated: true, nextEngagementDate: nextStr, source: 'disposition_cadence', cadenceDays };
  } catch (e) {
    if (e?.code === 'P2022' || e?.message?.includes('nextEngagementDate')) {
      return { updated: false };
    }
    throw e;
  }
}

// ─── LIST ─────────────────────────────────────────────────────────────────────

/**
 * Get all contacts for a company that have a nextEngagementDate set.
 * OPTED_OUT contacts are excluded because their date is always null.
 * Frontend buckets by date: today / this week / next month.
 */
export async function listContactsDue(companyHQId, options = {}) {
  const { limit = 500 } = options;

  const contacts = await prisma.contact.findMany({
    where: {
      crmId: companyHQId,
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
      contactDisposition: true,
      pipelineSnap: true,
      pipelineStageSnap: true,
      engagementSummary: true,
    },
  });

  return contacts.map((c) => ({
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
    contactDisposition: c.contactDisposition ?? null,
    pipeline: c.pipelineSnap ?? null,
    stage: c.pipelineStageSnap ?? null,
    engagementSummary: c.engagementSummary ?? null,
  }));
}

// ─── BOOLEAN CHECK ────────────────────────────────────────────────────────────

/** Is this contact overdue for follow-up? */
export async function isDue(contactId) {
  const result = await getNextEngagement(contactId);
  return result.nextEngagementDate != null && result.daysUntilDue <= 0;
}

// ─── LEGACY ALIASES (backward compat — no callers need to change) ─────────────

export const stampLastEngagement = stampEngagement;
export const getLastSendDate = getLastEngagement;
export const calculateNextSendDate = async (contactId) => {
  const r = await getNextEngagement(contactId);
  // Preserve old field name (nextSendDate) for existing callers
  return { ...r, nextSendDate: r.nextEngagementDate, relationship: r.relationship ?? null };
};
export const computeAndPersistNextEngagement = computeNextEngagement;
export const getContactsWithNextEngagement = listContactsDue;
export const isDueForFollowUp = isDue;
export const snapContactLastContactedAt = (contactId, sendDate) =>
  stampEngagement(contactId, sendDate, 'OUTBOUND_EMAIL');
