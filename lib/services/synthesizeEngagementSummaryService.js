/**
 * SYNTHESIZE ENGAGEMENT SUMMARY SERVICE
 *
 * Generates a single action-oriented sentence for a contact's current engagement status.
 * This sentence surfaces on outreach tracker, next engagements widget, and email reports.
 *
 * Examples of output:
 *   "Follow up needed — contact was warm and mentioned checking with stakeholders."
 *   "Press for introduction — last exchange was positive but no referral yet."
 *   "Re-engage — periodic check-in, no response in 6 weeks."
 */

import { prisma } from '../prisma.js';
import { OpenAI } from 'openai';

/**
 * Synthesize a single-sentence engagement summary for outreach surfaces.
 * @param {string} contactId
 * @returns {Promise<{summary: string | null, updated: boolean}>}
 */
export async function synthesizeEngagementSummary(contactId) {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        firstName: true,
        lastName: true,
        nextEngagementPurpose: true,
        nextContactNote: true,
        contactDisposition: true,
        lastEngagementType: true,
        lastEngagementDate: true,
        contactSummary: true,
        email_activities: {
          where: { summary: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { summary: true, sentAt: true, createdAt: true, emailSequenceOrder: true },
        },
      },
    });

    if (!contact) return { summary: null, updated: false };

    const recentSummaries = contact.email_activities
      .map((a) => {
        const date = a.sentAt || a.createdAt;
        const dateStr = date ? new Date(date).toISOString().slice(0, 10) : 'unknown';
        const dir = a.emailSequenceOrder === 'CONTACT_SEND' ? 'their reply' : 'outbound';
        return `[${dateStr} ${dir}] ${a.summary}`;
      })
      .join('\n');

    const contextBits = [
      contact.nextEngagementPurpose && `Purpose: ${contact.nextEngagementPurpose}`,
      contact.nextContactNote && `Note: ${contact.nextContactNote}`,
      contact.contactDisposition && `Disposition: ${contact.contactDisposition}`,
      contact.contactSummary && `Contact summary: ${contact.contactSummary.slice(0, 300)}`,
    ]
      .filter(Boolean)
      .join('\n');

    if (!recentSummaries && !contextBits) return { summary: null, updated: false };

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.3,
      max_tokens: 80,
      messages: [
        {
          role: 'system',
          content: `You write a single action-oriented sentence (max 20 words) describing where things stand with a contact and what needs to happen next. 
          
Focus on the next action or current status. Examples:
- "Follow-up due — contact was warm and said he'd check with his team."
- "Press for introduction — exchange was positive but no referral yet made."
- "Re-engage — periodic check-in, went quiet after initial interest."
- "Awaiting response — sent second outreach, no reply in three weeks."

Write ONLY the sentence. No quotes. No explanation.`,
        },
        {
          role: 'user',
          content: [
            contextBits && `Context:\n${contextBits}`,
            recentSummaries && `Recent interactions:\n${recentSummaries}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
    });

    const sentence = completion.choices?.[0]?.message?.content?.trim() || null;
    if (!sentence) return { summary: null, updated: false };

    await prisma.contact.update({
      where: { id: contactId },
      data: { engagementSummary: sentence },
    });

    return { summary: sentence, updated: true };
  } catch (error) {
    console.error('❌ synthesizeEngagementSummary error:', error);
    throw error;
  }
}
