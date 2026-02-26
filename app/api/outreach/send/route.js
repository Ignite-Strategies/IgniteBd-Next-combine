import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { readPayload, deletePayload } from '@/lib/redis';
import sgMail from '@sendgrid/mail';
import { handleServerError, getErrorStatusCode } from '@/lib/serverError';
import { snapContactLastContactedAt } from '@/lib/services/followUpCalculator';

// Initialize SendGrid (lazy)
let sendGridInitialized = false;
function initializeSendGrid() {
  if (sendGridInitialized) {
    return;
  }
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  
  if (!SENDGRID_API_KEY) {
    console.error('❌ SENDGRID_API_KEY environment variable is not set');
    throw new Error('SENDGRID_API_KEY not configured');
  }
  
  // Check for common issues
  const trimmedKey = SENDGRID_API_KEY.trim();
  if (trimmedKey !== SENDGRID_API_KEY) {
    console.warn('⚠️ SENDGRID_API_KEY has leading/trailing whitespace - trimming it');
  }
  
  if (trimmedKey.length === 0) {
    console.error('❌ SENDGRID_API_KEY is empty after trimming');
    throw new Error('SENDGRID_API_KEY is empty');
  }
  
  // Validate key format (SendGrid API keys start with "SG.")
  if (!trimmedKey.startsWith('SG.')) {
    console.warn('⚠️ SENDGRID_API_KEY does not start with "SG." - may be invalid format');
  }
  
  console.log('🔑 Initializing SendGrid API key:', {
    keyLength: trimmedKey.length,
    keyPrefix: trimmedKey.substring(0, 5) + '...',
    hasWhitespace: trimmedKey !== SENDGRID_API_KEY,
  });
  
  sgMail.setApiKey(trimmedKey);
  sendGridInitialized = true;
  console.log('✅ SendGrid API key set successfully');
}

/**
 * POST /api/outreach/send
 * 
 * Step 3: Send
 * 
 * Flow:
 * 1. Auth → verify Firebase token
 * 2. Fetch owner → get owner record
 * 3. Read payload from Redis → get EXACT payload (no rebuilding)
 * 4. Send to SendGrid → pass msg directly to sgMail.send(msg)
 * 5. Log activity → create email_activity record
 * 6. Delete payload from Redis → cleanup
 * 7. Return response
 * 
 * Invariant: Payload NEVER changes between preview and send
 * 
 * Request body:
 * {
 *   "requestId": "uuid-from-build-payload"
 * }
 */
export async function POST(request) {
  console.log('📧 POST /api/outreach/send - Request received');
  
  try {
    // Step 1: Auth
    const firebaseUser = await verifyFirebaseToken(request);

    // Step 2: Fetch owner
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: {
        id: true,
      },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    // Get requestId from body
    const body = await request.json();
    const { requestId } = body;

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'requestId is required' },
        { status: 400 }
      );
    }
    
    // Step 3: Retrieve payload blob from Redis
    // This is the EXACT same payload blob that was saved in build-payload
    // No rebuilding, no mutation, no transformation
    const msg = await readPayload(owner.id, requestId);

    if (!msg) {
      return NextResponse.json(
        { success: false, error: 'Payload not found or expired' },
        { status: 404 }
      );
    }

    console.log('📤 Retrieved payload blob from Redis:', {
      requestId,
      from: msg.from?.email,
      to: msg.personalizations[0]?.to[0]?.email,
      subject: msg.personalizations[0]?.subject,
    });

    // Step 4: Send payload blob directly to SendGrid API
    // SendGrid receives: exact payload blob with our verified sender email
    initializeSendGrid();

    let sendGridResponse;
    let messageId = null;
    let statusCode = null;

    try {
      sendGridResponse = await sgMail.send(msg);
      statusCode = sendGridResponse[0]?.statusCode;
      messageId = sendGridResponse[0]?.headers?.['x-message-id'] || 
                  sendGridResponse[0]?.headers?.['X-Message-Id'] || 
                  null;
    
      console.log('✅ SendGrid Response:', {
        statusCode,
        messageId,
      });
    } catch (sendGridError) {
      // Log raw SendGrid error (DO NOT normalize)
      console.error('❌ SendGrid error details:', {
        status: sendGridError?.response?.status,
        statusCode: sendGridError?.response?.statusCode,
        statusText: sendGridError?.response?.statusText,
        message: sendGridError?.message,
        code: sendGridError?.code,
      });
      console.error('❌ SendGrid response body:', sendGridError?.response?.body);
      console.error('❌ SendGrid errors array:', sendGridError?.response?.body?.errors);
      
      // Check if this is an auth error
      const errorStatusCode = sendGridError?.response?.statusCode || sendGridError?.response?.status;
      if (errorStatusCode === 401 || errorStatusCode === 403) {
        console.error('🔐 SendGrid Authentication Error Detected');
        console.error('   This usually means:');
        console.error('   1. API key is invalid, expired, or revoked');
        console.error('   2. API key does not have required permissions');
        console.error('   3. API key belongs to a different SendGrid account');
        console.error('   Check: SENDGRID_API_KEY environment variable');
      }
      
      // Return SendGrid's exact error (DO NOT convert to generic 500)
      const sendGridErrorBody = sendGridError.response?.body;
      const sendGridErrors = sendGridErrorBody?.errors || [];
      const firstError = sendGridErrors[0] || {};
      
      return NextResponse.json(
        {
          success: false,
          error: firstError.message || sendGridError.message || 'SendGrid API error',
          sendGridError: {
            statusCode: errorStatusCode,
            status: sendGridError?.response?.status,
            errors: sendGridErrors,
            body: sendGridErrorBody,
          },
        },
        { status: errorStatusCode || 500 }
      );
    }

    const toEmail = msg.personalizations[0]?.to[0]?.email || '';
    const subject = msg.personalizations[0]?.subject || '';
    const emailBody = msg.content[0]?.value || '';
    const customArgs = msg.personalizations[0]?.custom_args || {};
    const draftActivityId = customArgs.emailId || null;

    let emailActivityId = null;
    let createdEmailId = null;

    try {
      if (draftActivityId) {
        const updated = await prisma.email_activities.update({
          where: { id: draftActivityId },
          data: {
            messageId: messageId || null,
            event: 'sent',
            sentAt: new Date(),
          },
        });
        emailActivityId = updated.id;
        createdEmailId = updated.id;
        console.log('✅ Draft email activity updated and sent:', emailActivityId);
      } else {
        const contactId = customArgs.contactId || null;
        let activityKind = null;
        if (contactId) {
          const priorSends = await prisma.email_activities.count({
            where: {
              contact_id: contactId,
              OR: [{ event: 'sent' }, { source: 'OFF_PLATFORM' }],
            },
          });
          activityKind = priorSends > 0 ? 'SENT_REPLY' : 'SENT_INITIAL';
        }
        const emailActivity = await prisma.email_activities.create({
          data: {
            owner_id: owner.id,
            contact_id: contactId,
            tenant_id: customArgs.tenantId || null,
            campaign_id: customArgs.campaignId || null,
            sequence_id: customArgs.sequenceId || null,
            sequence_step_id: customArgs.sequenceStepId || null,
            email: toEmail,
            subject: subject,
            body: emailBody,
            messageId: messageId || null,
            event: 'sent',
            source: 'PLATFORM',
            platform: 'sendgrid',
            sentAt: new Date(),
            activityKind,
          },
        });
        emailActivityId = emailActivity.id;
        createdEmailId = emailActivity.id;
        console.log('✅ Email activity logged:', emailActivityId);
      }
    } catch (dbError) {
      console.warn('⚠️ Could not log email activity:', dbError.message);
    }

    // Snap lastContactedAt on contact (off-platform friendly)
    const contactIdForSnap = customArgs.contactId || null;
    if (contactIdForSnap) {
      try {
        await snapContactLastContactedAt(contactIdForSnap, new Date());
      } catch (snapErr) {
        console.warn('⚠️ Could not snap lastContactedAt:', snapErr.message);
      }
    }

    // Move contact deal pipeline to engaged-awaiting-response when first outreach sent (prospect + need-to-engage only)
    const contactIdForPipeline = customArgs.contactId || null;
    if (contactIdForPipeline) {
      try {
        const pipe = await prisma.pipelines.findUnique({ where: { contactId: contactIdForPipeline } });
        if (pipe?.pipeline === 'prospect' && pipe?.stage === 'need-to-engage') {
          await prisma.pipelines.update({
            where: { contactId: contactIdForPipeline },
            data: { stage: 'engaged-awaiting-response', updatedAt: new Date() },
          });
          console.log('✅ Deal pipeline stage → engaged-awaiting-response for contact:', contactIdForPipeline);
        }
      } catch (pipeErr) {
        console.warn('⚠️ Could not update deal pipeline stage:', pipeErr.message);
      }
    }

    // Step 6: Delete payload from Redis (cleanup)
    await deletePayload(owner.id, requestId);

    // Step 7: Return response
    return NextResponse.json({
      success: true,
      messageId: messageId || 'unknown',
      statusCode: statusCode || 202,
      emailId: createdEmailId, // Return emailId for compose UX
      emailActivityId: emailActivityId,
    });
  } catch (error) {
      // Handle error globally (logs to Vercel)
    const normalizedError = handleServerError(error, {
      route: '/api/outreach/send',
      requestUrl: request.url,
      requestMethod: request.method,
    });
    
    // Determine HTTP status code
    const statusCode = getErrorStatusCode(normalizedError);
    
    // Return proper HTTP response (error already logged/captured)
    return NextResponse.json(
      {
        success: false,
        error: normalizedError.message || 'Failed to send outreach email',
        details: process.env.NODE_ENV === 'development' ? normalizedError.stack : undefined,
      },
      { status: statusCode }
    );
  }
}

