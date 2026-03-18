/**
 * SYNTHESIZE CONTACT SUMMARY SERVICE
 *
 * Generates a rich, person-level narrative about a contact: who they are,
 * the relationship history, their disposition, any buying signals, and where
 * things currently stand. This lives on the contact record and is the source
 * of truth for "who is this person and why do we care."
 *
 * Source of truth: contact_engagement_log (single source).
 * Everything feeds into the log first — CSV ingest (INITIAL), manual notes
 * (POST_CALL / POST_MEETING), and email summaries (EMAIL_RESPONSE via emailToLogService).
 *
 * Backward compat: if no log entries exist yet, falls back to contact.notes.
 *
 * Example output:
 *   "Former colleague now at Blackstone as a Managing Director. Warm relationship —
 *    he's an advocate inside the firm and has offered to make introductions. Said
 *    he'd check with a few people on timing. Buying signal: actively exploring
 *    advisory relationships for their portfolio cos. Next step is to press for a
 *    warm intro to the decision-maker."
 */

import { prisma } from '../prisma.js';
import { OpenAI } from 'openai';

const ENTRY_TYPE_LABELS = {
  INITIAL:        'Initial context (from import)',
  POST_CALL:      'After call',
  POST_MEETING:   'After meeting',
  EMAIL_RESPONSE: 'Email exchange',
};

/**
 * Synthesize a rich contact summary narrative.
 * @param {string} contactId
 * @returns {Promise<{summary: string | null, updated: boolean}>}
 */
export async function synthesizeContactSummary(contactId) {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        crmId: true,
        firstName: true,
        lastName: true,
        title: true,
        companyName: true,
        contactDisposition: true,
        buyingReadiness: true,
        prior_relationship: true,
        persona_type: true,
        nextContactNote: true,
        notes: true, // backward compat — used as fallback when no log entries exist
        relationship_contexts: {
          select: {
            contextOfRelationship: true,
            relationshipRecency: true,
            formerCompany: true,
          },
        },
        companies: {
          select: { companyName: true, industry: true },
        },
        // Single source of truth — ordered chronologically
        engagement_log: {
          orderBy: { loggedAt: 'asc' },
          select: {
            entryType: true,
            note: true,
            loggedAt: true,
          },
        },
      },
    });

    if (!contact) return { summary: null, updated: false };

    // Pull owner company context so AI knows what service/product is being sold
    let ownerCompany = null;
    if (contact.crmId) {
      ownerCompany = await prisma.company_hqs.findUnique({
        where: { id: contact.crmId },
        select: { companyName: true, whatYouDo: true, companyIndustry: true },
      });
    }

    // Build structured contact profile block
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Contact';
    const company = contact.companyName || contact.companies?.companyName || null;
    const industry = contact.companies?.industry || null;

    const profileLines = [
      `Name: ${name}`,
      contact.title && `Title: ${contact.title}`,
      company && `Company: ${company}`,
      industry && `Industry: ${industry}`,
      contact.prior_relationship && `Relationship strength: ${contact.prior_relationship}`,
      contact.contactDisposition && `Disposition: ${contact.contactDisposition}`,
      contact.buyingReadiness && `Buying readiness: ${contact.buyingReadiness}`,
      contact.relationship_contexts?.contextOfRelationship &&
        `Relationship context: ${contact.relationship_contexts.contextOfRelationship}`,
      contact.relationship_contexts?.formerCompany &&
        `Former company: ${contact.relationship_contexts.formerCompany}`,
      contact.nextContactNote && `Next contact note: ${contact.nextContactNote}`,
    ]
      .filter(Boolean)
      .join('\n');

    // Owner company context
    const ownerContext = ownerCompany
      ? [
          `\nOWNER COMPANY (who is doing the outreach):`,
          `  Company: ${ownerCompany.companyName}`,
          ownerCompany.whatYouDo && `  What they do: ${ownerCompany.whatYouDo}`,
          ownerCompany.companyIndustry && `  Industry: ${ownerCompany.companyIndustry}`,
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    // Build engagement history from log entries (single source of truth)
    let engagementHistory = contact.engagement_log
      .map((entry) => {
        const dateStr = new Date(entry.loggedAt).toISOString().slice(0, 10);
        const label = ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType;
        return `[${dateStr} — ${label}]\n${entry.note}`;
      })
      .join('\n\n');

    // Backward compat: if no log entries exist, fall back to contact.notes
    if (!engagementHistory && contact.notes) {
      engagementHistory = `[Legacy notes]\n${contact.notes}`;
    }

    // Nothing to work from — skip generation
    if (!engagementHistory) return { summary: null, updated: false };

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.4,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `You write a concise narrative about a business contact for a BD professional's CRM.

CRITICAL RULES:
- Only use facts explicitly present in the engagement history or contact profile below.
- Do NOT invent meetings, conversations, interests, or buying signals that are not in the data.
- If a detail is not in the data, omit it entirely. Never fill gaps with plausible-sounding fiction.
- If the history is thin (e.g. only an initial import entry), write a brief accurate summary of what is known — who they are and the relationship context.

Write 2-4 sentences capturing only what is actually known:
1. Who this person is (role, company) — from profile
2. The relationship context or engagement history — from log entries
3. Any real buying signals, commitments, or next steps explicitly mentioned
4. Current status based on the most recent entry

Tone: direct, first-person CRM note. No fluff. Plain English. No bullet points. Flowing prose only.`,
        },
        {
          role: 'user',
          content: [
            ownerContext && ownerContext,
            `Contact profile:\n${profileLines}`,
            `Engagement history:\n${engagementHistory}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
    });

    const narrative = completion.choices?.[0]?.message?.content?.trim() || null;
    if (!narrative) return { summary: null, updated: false };

    await prisma.contact.update({
      where: { id: contactId },
      data: { contactSummary: narrative },
    });

    return { summary: narrative, updated: true };
  } catch (error) {
    console.error('❌ synthesizeContactSummary error:', error);
    throw error;
  }
}
