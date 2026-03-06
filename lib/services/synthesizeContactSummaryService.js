/**
 * SYNTHESIZE CONTACT SUMMARY SERVICE
 *
 * Generates a rich, person-level narrative about a contact: who they are,
 * the relationship history, their disposition, any buying signals, and where
 * things currently stand. This lives on the contact record and is the source
 * of truth for "who is this person and why do we care."
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

const DISPOSITION_LABELS = {
  ADVOCATE:           'champion — would make intros, actively helpful',
  WARM:               'warm and receptive — solid relationship, follow up regularly',
  WARM_WRONG_CONTACT: 'friendly but not the buyer — good for a warm intro, not a direct sale',
  WARM_NO_NEED:       'friendly but has another vendor/service — check in semi-annually',
  NEUTRAL:            'neutral — not resistant but not enthusiastic',
  COOLING:            'cooling — went cold or was put off, back off for now',
  OPTED_OUT:          'opted out — asked to stop contact',
};

const BUYING_READINESS_LABELS = {
  NOT_READY: 'not ready to buy',
  READY_NO_MONEY: 'ready in principle but no budget',
  READY_WITH_MONEY: 'ready and has budget',
};

const RELATIONSHIP_LABELS = {
  COLD: 'cold — no prior relationship',
  WARM: 'warm — some prior connection',
  ESTABLISHED: 'established relationship',
  DORMANT: 'dormant — was a relationship, gone quiet',
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
        nextEngagementPurpose: true,
        lastEngagementType: true,
        lastEngagementDate: true,
        notes: true,
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
        email_activities: {
          where: { summary: { not: null } },
          orderBy: { createdAt: 'asc' },
          take: 30,
          select: {
            summary: true,
            sentAt: true,
            createdAt: true,
            emailSequenceOrder: true,
            subject: true,
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

    // Build structured context block
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Contact';
    const company = contact.companyName || contact.companies?.companyName || null;
    const industry = contact.companies?.industry || null;

    const contextLines = [
      `Name: ${name}`,
      contact.title && `Title: ${contact.title}`,
      company && `Company: ${company}`,
      industry && `Industry: ${industry}`,
      contact.prior_relationship && `Relationship strength: ${RELATIONSHIP_LABELS[contact.prior_relationship] || contact.prior_relationship}`,
      contact.contactDisposition && `Disposition: ${DISPOSITION_LABELS[contact.contactDisposition] || contact.contactDisposition}`,
      contact.buyingReadiness && `Buying readiness: ${BUYING_READINESS_LABELS[contact.buyingReadiness] || contact.buyingReadiness}`,
      contact.persona_type && `Persona type: ${contact.persona_type}`,
      contact.relationship_contexts?.contextOfRelationship && `Relationship context: ${contact.relationship_contexts.contextOfRelationship}`,
      contact.relationship_contexts?.formerCompany && `Former company: ${contact.relationship_contexts.formerCompany}`,
      contact.notes && `Owner notes: ${contact.notes}`,
      contact.nextContactNote && `Next contact note: ${contact.nextContactNote}`,
    ]
      .filter(Boolean)
      .join('\n');

    // Owner company context — what service/product is actually being sold
    const ownerContext = ownerCompany
      ? [
          `\nOWNER COMPANY (who is doing the outreach):`,
          `  Company: ${ownerCompany.companyName}`,
          ownerCompany.whatYouDo && `  What they do: ${ownerCompany.whatYouDo}`,
          ownerCompany.companyIndustry && `  Industry: ${ownerCompany.companyIndustry}`,
        ].filter(Boolean).join('\n')
      : '';

    const emailHistory = contact.email_activities
      .map((a) => {
        const date = a.sentAt || a.createdAt;
        const dateStr = date ? new Date(date).toISOString().slice(0, 10) : 'unknown';
        const dir = a.emailSequenceOrder === 'CONTACT_SEND' ? '← their reply' : '→ outbound';
        const subj = a.subject ? ` [${a.subject}]` : '';
        return `[${dateStr} ${dir}${subj}] ${a.summary}`;
      })
      .join('\n\n');

    // Require at least one real email activity summary — without it the AI hallucinates.
    // Context-only (name, title, company) is not enough signal to generate a trustworthy narrative.
    if (!emailHistory) return { summary: null, updated: false };

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // TODO (post-MVP1): Pass ownerName here so AI writes "Joel's relationship with X..."
    // instead of "our relationship." Requires a primaryContactOwner field on company_hqs
    // (or Contact) that maps to the owner who actually owns the relationship — distinct
    // from managerId (Adam, the platform manager) and ownerId (the company account owner).
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.4,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `You write a concise narrative about a business contact for a BD professional's CRM.

CRITICAL RULES:
- Only use facts explicitly present in the email history or contact profile below. 
- Do NOT invent meetings, conferences, conversations, interests, or buying signals that are not in the data.
- If a detail is not in the data, omit it entirely. Never fill gaps with plausible-sounding fiction.
- If the history is thin, write a short accurate summary rather than a long fabricated one.

Write 2-4 sentences capturing only what is actually known:
1. Who this person is (role, company) — from profile data
2. The nature and quality of the actual exchanges — from email history only
3. Any real buying signals, commitments, or explicit next steps mentioned in the emails
4. Current status based on the most recent interaction

Tone: direct, first-person CRM note. No fluff. Plain English. No bullet points. Flowing prose only.`,
        },
        {
          role: 'user',
          content: [
            ownerContext && ownerContext,
            `Contact profile:\n${contextLines}`,
            emailHistory && `Email exchange history (subjects and summaries):\n${emailHistory}`,
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
