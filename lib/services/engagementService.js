/**
 * ENGAGEMENT SERVICE
 *
 * Two functions. That's it.
 *
 * lastEngagementDate + lastEngagementType — written directly by routes when
 * an event happens (send, respond, meeting, inbound parse). No service wrapper.
 *
 * nextEngagementDate — computed here. Manual UI overrides write directly.
 *
 * Disposition → cadence days:
 *   ADVOCATE / WARM / NEUTRAL / null  →  7 days  (AI-inferred preferred)
 *   WARM_WRONG_CONTACT                → 90 days  (quarterly)
 *   WARM_NO_NEED / COOLING            → 180 days (semi-annual)
 *   OPTED_OUT                         → null     (clears nextEngagementDate)
 */

import { prisma } from '../prisma.js';
import { OpenAI } from 'openai';

const DEFAULT_CADENCE_DAYS = 7;

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

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

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
Extract the implied next follow-up date. Examples:
- "follow up in 3-6 months" → midpoint ~4.5 months from today
- "reach out after Labor Day" → the day after Labor Day
- "call back next quarter" → first business day of next quarter
- "not interested, try again in a year" → 1 year from today
- "deferred to Q3" → July 1 (or next year if Q3 passed)
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
    return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  } catch (e) {
    console.warn('⚠️ inferDateFromSummary failed:', e?.message);
    return null;
  }
}

/**
 * Compute and persist nextEngagementDate for a contact.
 *
 *   1. OPTED_OUT → clear date, done
 *   2. Date already set → skip (manual override wins)
 *   3. No lastEngagementDate → nothing to compute yet
 *   4. Standard cadence contacts → try AI inference from latest activity summary
 *   5. Fallback → lastEngagementDate + disposition cadence days
 *
 * @returns {{ updated: boolean, nextEngagementDate: string|null, source: string }}
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

    if (cadenceDays <= DEFAULT_CADENCE_DAYS) {
      const latest = await prisma.email_activities.findFirst({
        where: { contact_id: contactId, summary: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { summary: true },
      });
      if (latest?.summary) {
        const aiDate = await inferDateFromSummary(latest.summary, todayStr);
        if (aiDate) {
          await prisma.contact.update({ where: { id: contactId }, data: { nextEngagementDate: aiDate } });
          return { updated: true, nextEngagementDate: aiDate, source: 'ai_summary' };
        }
      }
    }

    const nextStr = addDays(toDateOnlyString(contact.lastEngagementDate), cadenceDays);
    await prisma.contact.update({ where: { id: contactId }, data: { nextEngagementDate: nextStr } });
    return { updated: true, nextEngagementDate: nextStr, source: 'disposition_cadence', cadenceDays };
  } catch (e) {
    if (e?.code === 'P2022' || e?.message?.includes('nextEngagementDate')) return { updated: false };
    throw e;
  }
}

/**
 * All contacts for a company that have a nextEngagementDate set.
 * OPTED_OUT contacts never appear because their date is always null.
 * Frontend buckets by date: today / this week / next month.
 *
 * @returns {Promise<Array>}
 */
export async function listContactsDue(companyHQId, options = {}) {
  const { limit = 500 } = options;

  const contacts = await prisma.contact.findMany({
    where: { crmId: companyHQId, nextEngagementDate: { not: null } },
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
