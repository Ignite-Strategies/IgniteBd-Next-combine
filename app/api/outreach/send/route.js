import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { sendOutreachEmail } from '@/lib/services/outreachSendService';

/**
 * POST /api/outreach/send
 * 
 * SendGrid Email Send Route
 * 
 * Flow:
 * 1. Authenticates user via Firebase
 * 2. Gets owner record from database
 * 3. Grabs verified sender email (owner.sendgridVerifiedEmail)
 * 4. Grabs verified sender name (owner.sendgridVerifiedName)
 * 5. Takes subject line from request body
 * 6. Calls SendGrid email generator service (sendOutreachEmail)
 * 7. Service pushes email via SendGrid API
 * 8. Logs email activity in database
 * 
 * Requires Firebase authentication
 * Requires verified sender (owner.sendgridVerifiedEmail must be set)
 * 
 * Request body:
 * {
 *   "to": "prospect@example.com",
 *   "toName": "John Doe", (optional)
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
    
    // Get verified sender email/name from owner
    // ENFORCEMENT: Only use verified sender - never fallback to auth email
    const fromEmail = owner.sendgridVerifiedEmail;
    const fromName = owner.sendgridVerifiedName;
    
    // Strict enforcement: sender must be verified
    if (!fromEmail) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Sender not verified. Please verify your sender identity before sending emails. Go to compose page and click "Change" next to From field to verify your sender.' 
        },
        { status: 400 }
      );
    }

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

