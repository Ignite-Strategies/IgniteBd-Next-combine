import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { OpenAI } from 'openai';

/**
 * POST /api/contacts/[contactId]/generate-email-summaries
 *
 * Batch-generates AI summaries for all email_activities on this contact
 * that have body/emailRawText content but no summary yet.
 *
 * This is the first step in the chain:
 *   email summary → contact summary → engagement summary
 */
export async function POST(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { contactId } = await params;
    if (!contactId) {
      return NextResponse.json({ success: false, error: 'contactId required' }, { status: 400 });
    }

    // Fetch activities that have content but no summary
    const activities = await prisma.email_activities.findMany({
      where: {
        contact_id: contactId,
        summary: null,
        OR: [
          { body: { not: null } },
          { emailRawText: { not: null } },
        ],
      },
      select: {
        id: true,
        subject: true,
        body: true,
        emailRawText: true,
        emailSequenceOrder: true,
        sentAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (activities.length === 0) {
      return NextResponse.json({ success: true, generated: 0, message: 'No activities need summaries' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    let generated = 0;
    const errors = [];

    for (const activity of activities) {
      try {
        const content = (activity.emailRawText || activity.body || '').slice(0, 4000);
        const direction = activity.emailSequenceOrder === 'CONTACT_SEND' ? 'contact reply' : 'outbound send';
        const subject = activity.subject ? `Subject: ${activity.subject}\n` : '';

        const completion = await openai.chat.completions.create({
          model,
          temperature: 0.2,
          max_tokens: 120,
          messages: [
            {
              role: 'system',
              content: `You write a 1-2 sentence factual summary of a business email exchange. Focus on: what was said, the contact's disposition/response, and any explicit next steps or follow-up dates mentioned. This is a ${direction}. Be concise and factual — no fluff, no invented details.`,
            },
            {
              role: 'user',
              content: `${subject}${content}`,
            },
          ],
        });

        const summary = completion.choices?.[0]?.message?.content?.trim() || null;
        if (summary) {
          await prisma.email_activities.update({
            where: { id: activity.id },
            data: { summary },
          });
          generated++;
        }
      } catch (err) {
        console.error(`❌ Failed to summarize activity ${activity.id}:`, err.message);
        errors.push(activity.id);
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      skipped: errors.length,
      total: activities.length,
    });
  } catch (error) {
    console.error('❌ generate-email-summaries error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate summaries' },
      { status: 500 },
    );
  }
}
