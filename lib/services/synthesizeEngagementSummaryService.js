/**
 * SYNTHESIZE ENGAGEMENT SUMMARY SERVICE
 * 
 * Aggregates all email_activities.summary fields for a contact into a unified,
 * coherent narrative. This provides a high-level view of the entire engagement
 * history, complementing individual email summaries.
 */

import { prisma } from '../prisma.js';
import { OpenAI } from 'openai';

/**
 * Synthesize a unified engagement summary from all email activity summaries.
 * @param {string} contactId - Contact ID
 * @returns {Promise<{summary: string | null, updated: boolean}>}
 */
export async function synthesizeEngagementSummary(contactId) {
  try {
    // Fetch all email activities with summaries, ordered chronologically
    const activities = await prisma.email_activities.findMany({
      where: {
        contact_id: contactId,
        summary: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        summary: true,
        sentAt: true,
        createdAt: true,
        subject: true,
        source: true,
      },
      take: 50, // Limit to most recent 50 to avoid token limits
    });

    if (activities.length === 0) {
      return { summary: null, updated: false };
    }

    // Build context for AI synthesis
    const summaries = activities.map((a, idx) => {
      const date = a.sentAt || a.createdAt;
      const dateStr = date ? new Date(date).toISOString().slice(0, 10) : 'unknown date';
      return `[${dateStr}] ${a.summary}`;
    }).join('\n\n');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You synthesize engagement summaries from multiple email interaction summaries. Create a coherent, chronological narrative that captures:

1. The overall relationship trajectory (how it started, how it evolved)
2. The contact's disposition and interest level over time
3. Key decisions, commitments, or outcomes mentioned
4. Current status and any pending next steps

Write 3-5 sentences that tell the story of this engagement. Be concise but informative. Focus on what matters for relationship management and follow-up planning.

If the summaries are inconsistent or contradictory, note that in the synthesis.`,
        },
        {
          role: 'user',
          content: `Synthesize an engagement summary from these email interactions:\n\n${summaries}`,
        },
      ],
    });

    const synthesizedSummary = completion.choices?.[0]?.message?.content?.trim() || null;

    if (!synthesizedSummary) {
      return { summary: null, updated: false };
    }

    // Persist to Contact record
    await prisma.contact.update({
      where: { id: contactId },
      data: { engagementSummary: synthesizedSummary },
    });

    return { summary: synthesizedSummary, updated: true };
  } catch (error) {
    console.error('❌ synthesizeEngagementSummary error:', error);
    throw error;
  }
}
