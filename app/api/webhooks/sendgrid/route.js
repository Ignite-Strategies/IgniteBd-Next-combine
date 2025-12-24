import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * POST /api/webhooks/sendgrid
 * 
 * Receives signed events from SendGrid webhook
 * Verifies signature using SENDGRID_SIGNING_KEY
 * Updates EmailActivity records based on messageId
 * 
 * SendGrid webhook events:
 * - processed, delivered, opened, clicked, bounce, dropped, etc.
 */

// Route segment config for Next.js App Router
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Validate raw body
    if (!rawBody || rawBody.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empty webhook payload' },
        { status: 400 }
      );
    }

    // Parse JSON with error handling
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('❌ Failed to parse webhook JSON:', parseError);
      console.error('Raw body:', rawBody.substring(0, 500)); // Log first 500 chars
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Verify webhook signature (if SENDGRID_SIGNING_KEY is configured)
    const signingKey = process.env.SENDGRID_SIGNING_KEY;
    if (signingKey) {
      const signature = request.headers.get('x-twilio-email-event-webhook-signature');
      const timestamp = request.headers.get('x-twilio-email-event-webhook-timestamp');

      if (signature && timestamp) {
        const verified = verifySignature(rawBody, signature, timestamp, signingKey);
        if (!verified) {
          console.warn('⚠️ SendGrid webhook signature verification failed');
          return NextResponse.json(
            { success: false, error: 'Invalid signature' },
            { status: 401 }
          );
        }
      }
    } else {
      console.warn('⚠️ SENDGRID_SIGNING_KEY not configured - skipping signature verification');
    }

    // Process webhook events
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid webhook payload - expected array' },
        { status: 400 }
      );
    }

    const results = [];

    for (const event of body) {
      const {
        email,
        event: eventType,
        sg_message_id: messageId,
        timestamp,
      } = event;

      // Extract custom args - SendGrid sends them as custom_arg_* fields (snake_case)
      // SendGrid converts camelCase customArgs to snake_case in webhooks
      // e.g., customArgs: { ownerId: "123" } becomes custom_arg_owner_id: "123"
      const ownerId = event.custom_arg_owner_id || event['custom_arg_owner_id'];
      const contactId = event.custom_arg_contact_id || event['custom_arg_contact_id'];
      const tenantId = event.custom_arg_tenant_id || event['custom_arg_tenant_id'];
      const campaignId = event.custom_arg_campaign_id || event['custom_arg_campaign_id'];
      const sequenceId = event.custom_arg_sequence_id || event['custom_arg_sequence_id'];
      const sequenceStepId = event.custom_arg_sequence_step_id || event['custom_arg_sequence_step_id'];
      
      // Debug logging for custom args (only log if ownerId is missing - indicates a problem)
      if (!ownerId && eventType !== 'spamreport' && eventType !== 'unsubscribe') {
        console.warn('⚠️ Webhook event missing ownerId in custom args:', {
          eventType,
          email,
          availableCustomArgs: Object.keys(event).filter(k => k.startsWith('custom_arg_')),
          // Log first few custom args to see what's available
          sampleCustomArgs: Object.entries(event)
            .filter(([k]) => k.startsWith('custom_arg_'))
            .slice(0, 5)
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
        });
      }

      // Extract messageId from sg_message_id (format: <messageId@domain>)
      // Handle both formats: "messageId@domain" and just "messageId"
      let cleanMessageId = null;
      if (messageId) {
        if (typeof messageId === 'string' && messageId.includes('@')) {
          cleanMessageId = messageId.split('@')[0];
        } else {
          cleanMessageId = messageId.toString();
        }
      }

      if (!cleanMessageId) {
        console.warn('⚠️ Webhook event missing messageId:', {
          eventType: event?.event,
          email: event?.email,
          rawMessageId: messageId,
        });
        results.push({ 
          messageId: null, 
          event: eventType || 'unknown', 
          status: 'skipped',
          reason: 'missing_message_id'
        });
        continue;
      }

      try {

        // Find email activity by messageId
        const emailActivity = await prisma.email_activities.findUnique({
          where: { messageId: cleanMessageId },
        });

        if (emailActivity) {
          // Update event state (latest event) - MVP1: just track latest, no detailed events table
          await prisma.email_activities.update({
            where: { messageId: cleanMessageId },
            data: {
              event: eventType, // delivered, opened, clicked, bounce, etc.
              updatedAt: timestamp ? new Date(timestamp * 1000) : new Date(),
            },
          });

          console.log(`✅ Updated email activity ${emailActivity.id}: ${eventType} for messageId ${cleanMessageId}`);
          results.push({ 
            messageId: cleanMessageId, 
            event: eventType, 
            status: 'updated',
            emailActivityId: emailActivity.id
          });
        } else {
          // If activity doesn't exist, create it (in case webhook arrives before DB write)
          // IMPORTANT: ownerId is required to create activity - without it we can't track
          if (ownerId) {
            // Convert ownerId to string if it's not already (SendGrid might send as number)
            const ownerIdStr = ownerId.toString();
            
            const newActivity = await prisma.email_activities.create({
              data: {
                owner_id: ownerIdStr,
                contact_id: contactId ? contactId.toString() : null,
                tenant_id: tenantId ? tenantId.toString() : null,
                campaign_id: campaignId ? campaignId.toString() : null,
                sequence_id: sequenceId ? sequenceId.toString() : null,
                sequence_step_id: sequenceStepId ? sequenceStepId.toString() : null,
                email: email || 'unknown',
                subject: 'Unknown', // Webhook doesn't include subject
                body: '', // Webhook doesn't include body
                messageId: cleanMessageId,
                event: eventType,
              },
            });

            console.log(`✅ Created email activity ${newActivity.id} from webhook: ${eventType} for messageId ${cleanMessageId}`);
            results.push({ 
              messageId: cleanMessageId, 
              event: eventType, 
              status: 'created',
              emailActivityId: newActivity.id
            });
          } else {
            console.warn(`⚠️ Webhook event missing ownerId, cannot create activity:`, {
              messageId: cleanMessageId,
              eventType,
              email,
              // Log all custom args to debug
              customArgs: {
                ownerId: event.custom_arg_owner_id,
                contactId: event.custom_arg_contact_id,
                tenantId: event.custom_arg_tenant_id,
                campaignId: event.custom_arg_campaign_id,
                sequenceId: event.custom_arg_sequence_id,
                sequenceStepId: event.custom_arg_sequence_step_id,
              },
              // Log full event for debugging (first 500 chars)
              eventPreview: JSON.stringify(event).substring(0, 500),
            });
            results.push({ 
              messageId: cleanMessageId, 
              event: eventType, 
              status: 'skipped',
              reason: 'missing_owner_id'
            });
          }
        }
      } catch (error) {
        console.error(`❌ Error processing webhook event for ${cleanMessageId}:`, error);
        results.push({ messageId: cleanMessageId, event: eventType, status: 'error', error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('❌ SendGrid webhook error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process webhook',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    );
  }
}

/**
 * Verify SendGrid webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Signature from header
 * @param {string} timestamp - Timestamp from header
 * @param {string} publicKey - Public key from SENDGRID_SIGNING_KEY
 * @returns {boolean} - True if signature is valid
 */
function verifySignature(payload, signature, timestamp, publicKey) {
  try {
    // SendGrid uses ECDSA signature verification
    // Format: timestamp + payload
    const signedPayload = timestamp + payload;

    // Decode signature (base64)
    const signatureBuffer = Buffer.from(signature, 'base64');

    // Verify using public key
    const verify = crypto.createVerify('SHA256');
    verify.update(signedPayload);
    verify.end();

    // Parse public key (PEM format)
    const key = publicKey.startsWith('-----BEGIN') 
      ? publicKey 
      : `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

    return verify.verify(key, signatureBuffer);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

