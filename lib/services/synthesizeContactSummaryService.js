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
  HAPPY_TO_RECEIVE_NOTE: 'open and receptive — happy to receive notes',
  NEUTRAL: 'neutral — not resistant but not enthusiastic',
  DOESNT_CARE: 'low receptivity — unlikely to engage',
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
        relationship_contexts: {
          select: {
            contextOfRelationship: true,
            relationshipRecency: true,
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
      contact.nextContactNote && `Owner note: ${contact.nextContactNote}`,
    ]
      .filter(Boolean)
      .join('\n');

    const emailHistory = contact.email_activities
      .map((a) => {
        const date = a.sentAt || a.createdAt;
        const dateStr = date ? new Date(date).toISOString().slice(0, 10) : 'unknown';
        const dir = a.emailSequenceOrder === 'CONTACT_SEND' ? '← their reply' : '→ outbound';
        const subj = a.subject ? ` [${a.subject}]` : '';
        return `[${dateStr} ${dir}${subj}] ${a.summary}`;
      })
      .join('\n\n');

    if (!emailHistory && !contextLines) return { summary: null, updated: false };

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.4,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `You write a concise but rich narrative about a business contact from the perspective of a BD professional managing their CRM. 

Write 2-4 sentences that capture:
1. Who this person is (role, company, how they know each other)
2. The relationship quality and their disposition
3. Any buying signals, commitments, or meaningful context
4. Current status and what matters most right now

Tone: direct, professional, first-person CRM note. No fluff. Use plain English. 
If there are buying signals, call them out explicitly. If the person was warm/cold/resistant, say so plainly.
Do NOT use bullet points. Write flowing prose sentences only.`,
        },
        {
          role: 'user',
          content: [
            `Contact profile:\n${contextLines}`,
            emailHistory && `Email exchange history:\n${emailHistory}`,
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
