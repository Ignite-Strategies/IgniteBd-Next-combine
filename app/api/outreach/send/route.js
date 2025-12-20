import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { sendOutreachEmail } from '@/lib/services/outreachSendService';

/**
 * POST /api/outreach/send
 * 
 * Send 1-to-1 outreach email via SendGrid
 * Requires Firebase authentication
 * 
 * Request body:
 * {
 *   "to": "prospect@example.com",
 *   "subject": "Quick intro",
 *   "body": "Hey, saw your work on...",
 *   "contactId": "c_123", (optional)
 *   "tenantId": "t_001" (optional)
 * }
 */
export async function POST(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);

    // Get or find Owner record
    let owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
        sendgridVerifiedEmail: true,
        sendgridVerifiedName: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!owner) {
      // Create owner if it doesn't exist
      owner = await prisma.owners.create({
        data: {
          firebaseId: firebaseUser.uid,
          email: firebaseUser.email || null,
          name: firebaseUser.name || null,
        },
        select: {
          id: true,
          sendgridVerifiedEmail: true,
          sendgridVerifiedName: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
    }

    const ownerId = owner.id;
    
    // Get verified sender email/name from owner, with fallbacks
    const fromEmail = owner.sendgridVerifiedEmail || owner.email || process.env.SENDGRID_FROM_EMAIL || 'adam@ignitestrategies.co';
    const fromName = owner.sendgridVerifiedName || 
                     (owner.firstName && owner.lastName ? `${owner.firstName} ${owner.lastName}` : owner.firstName || owner.lastName || '') ||
                     process.env.SENDGRID_FROM_NAME || 
                     'Adam - Ignite Strategies';

    // Parse request body
    const body = await request.json();
    const { 
      to, 
      subject, 
      body: emailBody, 
      contactId, 
      tenantId, 
      toName,
      campaignId,
      sequenceId,
      sequenceStepId,
    } = body;

    // Validation
    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { success: false, error: 'to, subject, and body are required' },
        { status: 400 }
      );
    }

    // Send email via SendGrid
    const { statusCode, messageId } = await sendOutreachEmail({
      to,
      toName,
      subject,
      body: emailBody,
      ownerId,
      contactId,
      tenantId,
      campaignId: campaignId || null,
      sequenceId: sequenceId || null,
      sequenceStepId: sequenceStepId || null,
      from: fromEmail,
      fromName: fromName,
    });

    // Log email activity in database (Apollo-like tracking)
    const emailActivity = await prisma.email_activities.create({
      data: {
        owner_id: ownerId,
        contact_id: contactId || null,
        tenant_id: tenantId || null,
        campaign_id: campaignId || null,
        sequence_id: sequenceId || null,
        sequence_step_id: sequenceStepId || null,
        email: to,
        subject,
        body: emailBody,
        messageId,
        event: 'sent', // Initial state
      },
    });

    console.log(`✅ Email activity logged: ${emailActivity.id}`);

    return NextResponse.json({
      success: true,
      messageId,
      statusCode,
      emailActivityId: emailActivity.id,
    });
  } catch (error) {
    console.error('Outreach send error:', error);
    
    // Determine appropriate status code
    let statusCode = 500;
    if (error.message?.includes('Unauthorized') || error.message?.includes('authentication')) {
      statusCode = 401;
    } else if (error.message?.includes('credits') || error.message?.includes('exceeded')) {
      statusCode = 402; // Payment Required
    } else if (error.message?.includes('permission') || error.message?.includes('Forbidden')) {
      statusCode = 403;
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send outreach email',
      },
      { status: statusCode }
    );
  }
}

