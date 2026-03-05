/**
 * EMAIL CADENCE SERVICE
 *
 * Single universal engagement model — no sent/responded ping-pong.
 *
 * Inputs (all on the Contact record):
 *   - lastEngagementDate:  DateTime — most recent interaction (sent or received)
 *   - lastEngagementType:  EngagementType — OUTBOUND_EMAIL | CONTACT_RESPONSE | MEETING | MANUAL
 *   - nextEngagementDate:  String "YYYY-MM-DD" — stored next engage (wins when already set)
 *   - doNotContactAgain:   Boolean
 *
 * computeAndPersistNextEngagement is the "smart" layer:
 *   1. Reads latest email_activities.summary for the contact
 *   2. Uses AI to infer a follow-up date from the summary (e.g. "follow up in Q3", "call back after Labor Day")
 *   3. Falls back to lastEngagementDate + 7 days only when there's no signal
 *
 * calculateNextSendDate is the "dumb" fallback (rules only, no AI).
 */

import { prisma } from '../prisma.js';
import { OpenAI } from 'openai';

const AUTO_CADENCE_DAYS = 7;

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

/**
 * Stamp lastEngagementDate on Contact. Only moves forward (never overwrites a newer date).
 * Replaces snapContactLastContactedAt — universal for all engagement types.
 */
export async function stampLastEngagement(contactId, date, engagementType) {
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
      lastEngagementType: engagementType || 'MANUAL',
    },
  });
  return { updated: true };
}

/**
 * Last engagement date for a contact. Thin wrapper for backward compat.
 */
export async function getLastSendDate(contactId) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { lastEngagementDate: true },
  });
  return contact?.lastEngagementDate ? new Date(contact.lastEngagementDate) : null;
}

/**
 * Calculate next send date from lastEngagementDate. Dead simple.
 */
export async function calculateNextSendDate(contactId) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      doNotContactAgain: true,
      lastEngagementDate: true,
      lastEngagementType: true,
      nextEngagementDate: true,
      nextContactNote: true,
      prior_relationship: true,
    },
  });

  if (!contact) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  const todayStr = getTodayString();

  if (contact.doNotContactAgain) {
    return {
      nextSendDate: null,
      lastEngagementDate: contact.lastEngagementDate,
      lastEngagementType: contact.lastEngagementType,
      daysUntilDue: null,
      relationship: contact.prior_relationship,
      cadenceDays: null,
      isManualOverride: true,
      doNotContactAgain: true,
      nextContactNote: contact.nextContactNote ?? null,
    };
  }

  if (contact.nextEngagementDate) {
    return {
      nextSendDate: contact.nextEngagementDate,
      lastEngagementDate: contact.lastEngagementDate,
      lastEngagementType: contact.lastEngagementType,
      daysUntilDue: dayDiff(contact.nextEngagementDate, todayStr),
      relationship: contact.prior_relationship,
      cadenceDays: null,
      isManualOverride: true,
      doNotContactAgain: false,
      nextContactNote: contact.nextContactNote ?? null,
    };
  }

  if (!contact.lastEngagementDate) {
    return {
      nextSendDate: null,
      lastEngagementDate: null,
      lastEngagementType: null,
      daysUntilDue: null,
      relationship: contact.prior_relationship,
      cadenceDays: null,
      isManualOverride: false,
      doNotContactAgain: false,
      nextContactNote: null,
    };
  }

  const lastStr = toDateOnlyString(contact.lastEngagementDate);
  const nextStr = addDaysToDateString(lastStr, AUTO_CADENCE_DAYS);

  return {
    nextSendDate: nextStr,
    lastEngagementDate: contact.lastEngagementDate,
    lastEngagementType: contact.lastEngagementType,
    daysUntilDue: dayDiff(nextStr, todayStr),
    relationship: contact.prior_relationship,
    cadenceDays: AUTO_CADENCE_DAYS,
    isManualOverride: false,
    doNotContactAgain: false,
    nextContactNote: null,
  };
}

/**
 * Infer a follow-up date from an activity summary using AI.
 * Returns "YYYY-MM-DD" or null if no timing signal found.
 */
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

Given an activity summary, extract the implied next follow-up date. Examples:
- "follow up in 3-6 months" → midpoint ~4.5 months from today
- "reach out after Labor Day" → the day after Labor Day
- "call back next quarter" → first business day of next quarter
- "not interested, said try again in a year" → 1 year from today
- "deferred to Q3" → July 1 of this year (or next if Q3 has passed)
- "set meeting for March 15" → March 15
- "positive response, scheduling call" → 3 days from today
- "no timing signal, just a general check-in" → null

Return ONLY a JSON object: {"date": "YYYY-MM-DD"} or {"date": null}
Return null when there is NO timing cue in the summary.`,
        },
        { role: 'user', content: summary },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const d = parsed?.date;
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      console.log(`🧠 AI inferred next engagement from summary: ${d}`);
      return d;
    }
    return null;
  } catch (e) {
    console.warn('⚠️ inferDateFromSummary failed (falling back to rules):', e?.message);
    return null;
  }
}

/**
 * Compute and persist nextEngagementDate.
 *
 * Smart layer:
 *   1. If nextEngagementDate already set → keep it (skip)
 *   2. Read latest email_activities.summary for this contact
 *   3. AI-infer a date from the summary (e.g. "follow up in Q3")
 *   4. Fall back to lastEngagementDate + 7 days
 */
export async function computeAndPersistNextEngagement(contactId) {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        doNotContactAgain: true,
        lastEngagementDate: true,
        nextEngagementDate: true,
      },
    });

    if (!contact) return { updated: false, error: 'Contact not found' };

    if (contact.doNotContactAgain) {
      await prisma.contact.update({
        where: { id: contactId },
        data: { nextEngagementDate: null, nextEngagementPurpose: null },
      });
      return { updated: true, nextEngagementDate: null, source: 'do_not_contact' };
    }

    if (contact.nextEngagementDate) {
      return { updated: false, nextEngagementDate: contact.nextEngagementDate, source: 'already_set' };
    }

    if (!contact.lastEngagementDate) {
      return { updated: false, nextEngagementDate: null, source: 'no_engagement' };
    }

    const todayStr = getTodayString();

    // Try AI inference from latest activity summary
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

    // Fallback: lastEngagementDate + 7 days
    const lastStr = toDateOnlyString(contact.lastEngagementDate);
    const nextStr = addDaysToDateString(lastStr, AUTO_CADENCE_DAYS);

    await prisma.contact.update({
      where: { id: contactId },
      data: { nextEngagementDate: nextStr },
    });
    return { updated: true, nextEngagementDate: nextStr, source: 'default_cadence' };
  } catch (e) {
    if (e?.code === 'P2022' || e?.message?.includes('nextEngagementDate')) {
      return { updated: false };
    }
    throw e;
  }
}

export async function isDueForFollowUp(contactId) {
  const result = await calculateNextSendDate(contactId);
  return result.nextSendDate != null && result.daysUntilDue <= 0;
}

/**
 * @deprecated Use stampLastEngagement() instead.
 * Kept temporarily for backward compatibility during migration.
 */
export async function snapContactLastContactedAt(contactId, sendDate) {
  return stampLastEngagement(contactId, sendDate, 'OUTBOUND_EMAIL');
}
