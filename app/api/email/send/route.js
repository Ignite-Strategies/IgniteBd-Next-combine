import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { sendEmail, sendBatchEmails } from '@/lib/sendgridClient';

/**
 * POST /api/email/send
 * 
 * Send email via SendGrid
 * Requires Firebase authentication
 */
export async function POST(request) {
  try {
    // Verify Firebase authentication
    await verifyFirebaseToken(request);

    const body = await request.json();
    const {
      to,
      toName,
      subject,
      html,
      text,
      from,
      fromName,
      cc,
      bcc,
      trackOpens,
      trackClicks,
      batch, // If true, expects emails array
      emails, // Array of email objects for batch sending
      delaySeconds, // Delay between batch emails
    } = body;

    // Batch email sending
    if (batch && Array.isArray(emails) && emails.length > 0) {
      const results = await sendBatchEmails(emails, delaySeconds || 2);
      return NextResponse.json({
        success: true,
        ...results,
      });
    }

    // Single email sending
    if (!to || !subject || !html) {
      return NextResponse.json(
        { success: false, error: 'to, subject, and html are required' },
        { status: 400 }
      );
    }

    const result = await sendEmail({
      to,
      toName,
      subject,
      html,
      text,
      from,
      fromName,
      cc,
      bcc,
      trackOpens,
      trackClicks,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      statusCode: result.statusCode,
    });
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send email',
      },
      { status: 500 }
    );
  }
}

