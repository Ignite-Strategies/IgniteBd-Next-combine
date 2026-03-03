import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getContactsWithNextEngagement } from '@/lib/services/nextEngagementService';
import { sendEmail } from '@/lib/sendgridClient';
import { formatNextEngagementEmailHtml, formatNextEngagementEmailText } from '@/lib/email/nextEngagementEmailTemplate';

/**
 * POST /api/outreach/send-next-engagement-email
 *
 * Sends the next engagement container as an email. Uses the signed-in owner's
 * verified SendGrid sender (sendgridVerifiedEmail / sendgridVerifiedName).
 *
 * Request body:
 * {
 *   "recipientName": "John Doe",
 *   "recipientEmail": "john@example.com",
 *   "companyHQId": "company-id",
 *   "customMessage": "optional intro text"
 * }
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid recipient email format' },
        { status: 400 },
      );
    }

    // Resolve owner and verified sender (same model as 1:1 compose)
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
      },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    if (!owner.sendgridVerifiedEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No verified sender. Verify your sender email in Settings (SendGrid Sender Identity) before sending.',
        },
        { status: 400 },
      );
    }

    const nextEngagements = await getContactsWithNextEngagement(companyHQId, { limit: 500 });

    if (nextEngagements.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No next engagements found for this company' },
        { status: 404 },
      );
    }

    const subject = `Next Engagement Report - ${new Date().toLocaleDateString()}`;
    const html = formatNextEngagementEmailHtml(nextEngagements, customMessage);
    const text = formatNextEngagementEmailText(nextEngagements, customMessage);

    // Send using owner's verified sender (same as 1:1 compose)
    const result = await sendEmail({
      to: recipientEmail,
      toName: recipientName || recipientEmail.split('@')[0],
      subject,
      html,
      text,
      from: owner.sendgridVerifiedEmail,
      fromName: owner.sendgridVerifiedName || undefined,
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
