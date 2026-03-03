import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getContactsWithNextEngagement } from '@/lib/services/nextEngagementService';
import { sendEmail } from '@/lib/sendgridClient';
import { formatNextEngagementEmailHtml, formatNextEngagementEmailText } from '@/lib/email/nextEngagementEmailTemplate';

/**
 * POST /api/outreach/send-next-engagement-email
 * 
 * Sends the next engagement container data as an email to a specified recipient.
 * 
 * Request body:
 * {
 *   "recipientName": "John Doe",
 *   "recipientEmail": "john@example.com",
 *   "companyHQId": "company-id"
 * }
 */
export async function POST(request) {
  try {
    // Auth
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { recipientName, recipientEmail, companyHQId, customMessage } = body;

    if (!recipientEmail || !companyHQId) {
      return NextResponse.json(
        { success: false, error: 'recipientEmail and companyHQId are required' },
        { status: 400 },
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid recipient email format' },
        { status: 400 },
      );
    }

    // Fetch next engagement data
    const nextEngagements = await getContactsWithNextEngagement(companyHQId, { limit: 500 });

    if (nextEngagements.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No next engagements found for this company' },
        { status: 404 },
      );
    }

    // Format email
    const subject = `Next Engagement Report - ${new Date().toLocaleDateString()}`;
    const html = formatNextEngagementEmailHtml(nextEngagements, customMessage);
    const text = formatNextEngagementEmailText(nextEngagements, customMessage);

    // Send email via SendGrid
    const result = await sendEmail({
      to: recipientEmail,
      toName: recipientName || recipientEmail.split('@')[0],
      subject,
      html,
      text,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      contactsCount: nextEngagements.length,
    });
  } catch (error) {
    console.error('❌ POST /api/outreach/send-next-engagement-email error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to send next engagement email' },
      { status: 500 },
    );
  }
}
