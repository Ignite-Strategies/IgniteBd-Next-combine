import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken } from '@/lib/microsoftGraphClient';
import { getRedis } from '@/lib/redis';
import crypto from 'crypto';

/**
 * GET /api/microsoft/email-contacts/preview
 * 
 * Fetch and aggregate email senders from Microsoft Graph messages
 * Returns preview of unique people from email metadata
 * 
 * Returns:
 * {
 *   "generatedAt": "ISO_TIMESTAMP",
 *   "limit": 50,
 *   "items": [
 *     {
 *       "previewId": "hash_of_email",
 *       "email": "user@example.com",
 *       "displayName": "John Doe",
 *       "domain": "example.com",
 *       "stats": {
 *         "firstSeenAt": "2025-01-27T10:00:00Z",
 *         "lastSeenAt": "2025-01-27T12:00:00Z",
 *         "messageCount": 5
 *       }
 *     }
 *   ]
 * }
 * 
 * Behavior:
 * - Checks Redis first (preview:microsoft_email:${ownerId})
 * - If miss → fetch 50 messages, aggregate, store in Redis
 * - TTL: 30-60 minutes
 * - No database writes
 */
export async function GET(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    // Check Redis for existing preview
    const redisClient = getRedis();
    const redisKey = `preview:microsoft_email:${owner.id}`;
    
    try {
      const cached = await redisClient.get(redisKey);
      if (cached) {
        const cachedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
        console.log(`✅ Returning cached Microsoft email preview for owner: ${owner.id}`);
        return NextResponse.json({
          success: true,
          ...cachedData,
        });
      }
    } catch (redisError) {
      console.warn('⚠️ Redis get failed (will recompute):', redisError.message);
    }

    // Get valid access token (handles refresh automatically)
    let accessToken;
    try {
      accessToken = await getValidAccessToken(owner.id);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Microsoft account not connected. Please connect your Microsoft account first.' },
        { status: 401 }
      );
    }

    // Fetch 50 messages from Microsoft Graph
    const graphUrl = 'https://graph.microsoft.com/v1.0/me/messages?$select=from,receivedDateTime&$top=50&$orderby=receivedDateTime desc';
    
    let messagesResponse;
    try {
      const response = await fetch(graphUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Graph API error: ${response.status}`);
      }

      messagesResponse = await response.json();
    } catch (error) {
      console.error('❌ Microsoft Graph API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch messages from Microsoft Graph',
          details: error.message,
        },
        { status: 500 }
      );
    }

    const messages = messagesResponse.value || [];

    // Filter out automated/business emails
    function isAutomatedEmail(email, displayName) {
      const emailLower = email.toLowerCase();
      const nameLower = (displayName || '').toLowerCase();
      
      // Common automated email patterns
      const automatedPatterns = [
        /^noreply@/i,
        /^no-reply@/i,
        /^donotreply@/i,
        /^donot-reply@/i,
        /^automated@/i,
        /^automation@/i,
        /^system@/i,
        /^notification@/i,
        /^notifications@/i,
        /^alerts@/i,
        /^mailer@/i,
        /^mailer-daemon@/i,
        /^postmaster@/i,
        /^webmaster@/i,
        /^support@/i,
        /^help@/i,
        /^info@/i,
        /^contact@/i,
        /^hello@/i,
        /^hi@/i,
      ];
      
      // Check email patterns
      if (automatedPatterns.some(pattern => pattern.test(emailLower))) {
        return true;
      }
      
      // Common automated/business domains
      const automatedDomains = [
        'sendgrid.com',
        'sendgrid.net',
        'mail.sendgrid.net',
        'godaddy.com',
        'venmo.com',
        'email.venmo.com',
        'bluevine.com',
        'email.bluevine.com',
        'stripe.com',
        'mail.stripe.com',
        'paypal.com',
        'mail.paypal.com',
        'amazon.com',
        'amazonaws.com',
        'mail.amazon.com',
        'github.com',
        'noreply.github.com',
        'linkedin.com',
        'notifications.linkedin.com',
        'facebook.com',
        'mail.facebook.com',
        'twitter.com',
        'x.com',
        'mail.x.com',
        'google.com',
        'mail.google.com',
        'microsoft.com',
        'mail.microsoft.com',
        'outlook.com',
        'mail.outlook.com',
        'mailchimp.com',
        'mail.mailchimp.com',
        'hubspot.com',
        'mail.hubspot.com',
        'salesforce.com',
        'mail.salesforce.com',
        'zendesk.com',
        'mail.zendesk.com',
        'intercom.com',
        'mail.intercom.com',
        'slack.com',
        'mail.slack.com',
        'dropbox.com',
        'mail.dropbox.com',
        'zoom.us',
        'mail.zoom.us',
        'calendly.com',
        'mail.calendly.com',
        'eventbrite.com',
        'mail.eventbrite.com',
        'square.com',
        'mail.square.com',
        'quickbooks.com',
        'mail.quickbooks.com',
        'xero.com',
        'mail.xero.com',
        'freshbooks.com',
        'mail.freshbooks.com',
      ];
      
      const domain = emailLower.split('@')[1];
      if (automatedDomains.includes(domain)) {
        return true;
      }
      
      // Check if displayName looks like a business/service name (common patterns)
      const businessNamePatterns = [
        /^sendgrid$/i,
        /^godaddy/i,
        /^venmo$/i,
        /^bluevine$/i,
        /^stripe$/i,
        /^paypal$/i,
        /^amazon$/i,
        /^github$/i,
        /^linkedin$/i,
        /^facebook$/i,
        /^twitter$/i,
        /^google$/i,
        /^microsoft$/i,
        /^outlook$/i,
        /^mailchimp$/i,
        /^hubspot$/i,
        /^salesforce$/i,
        /^zendesk$/i,
        /^intercom$/i,
        /^slack$/i,
        /^dropbox$/i,
        /^zoom$/i,
        /^calendly$/i,
        /^eventbrite$/i,
        /^square$/i,
        /^quickbooks$/i,
        /^xero$/i,
        /^freshbooks$/i,
        /renewals?$/i,
        /notifications?$/i,
        /alerts?$/i,
        /updates?$/i,
        /newsletter$/i,
        /marketing$/i,
      ];
      
      if (businessNamePatterns.some(pattern => pattern.test(nameLower))) {
        return true;
      }
      
      return false;
    }

    // Aggregate messages into unique people by email address
    const contactMap = new Map();

    for (const message of messages) {
      const from = message.from;
      if (!from || !from.emailAddress) {
        continue;
      }

      const email = from.emailAddress.address?.toLowerCase().trim();
      if (!email || !email.includes('@')) {
        continue;
      }

      const displayName = from.emailAddress.name || email.split('@')[0];
      
      // Skip automated/business emails
      if (isAutomatedEmail(email, displayName)) {
        continue;
      }
      
      const domain = email.split('@')[1];
      const receivedDateTime = message.receivedDateTime;

      // Generate stable previewId (hash of email)
      const previewId = crypto.createHash('sha256').update(email).digest('hex').substring(0, 16);

      if (contactMap.has(email)) {
        const existing = contactMap.get(email);
        existing.stats.messageCount += 1;
        // Update lastSeenAt if this message is more recent
        if (receivedDateTime) {
          if (!existing.stats.lastSeenAt || receivedDateTime > existing.stats.lastSeenAt) {
            existing.stats.lastSeenAt = receivedDateTime;
          }
          // Update firstSeenAt if this message is older
          if (!existing.stats.firstSeenAt || receivedDateTime < existing.stats.firstSeenAt) {
            existing.stats.firstSeenAt = receivedDateTime;
          }
        }
        // Update displayName if we have a better one (non-empty, non-email)
        if (displayName && displayName !== email && displayName.includes(' ')) {
          existing.displayName = displayName;
        }
      } else {
        contactMap.set(email, {
          previewId,
          email,
          displayName: displayName !== email ? displayName : undefined,
          domain,
          stats: {
            firstSeenAt: receivedDateTime || new Date().toISOString(),
            lastSeenAt: receivedDateTime || new Date().toISOString(),
            messageCount: 1,
          },
        });
      }
    }

    // Convert map to array
    const items = Array.from(contactMap.values());

    // Prepare preview data
    const previewData = {
      generatedAt: new Date().toISOString(),
      limit: 50,
      items,
    };

    // Store in Redis with 45 minute TTL
    try {
      const ttl = 45 * 60; // 45 minutes
      await redisClient.setex(
        redisKey,
        ttl,
        JSON.stringify(previewData)
      );
      console.log(`✅ Microsoft email preview stored in Redis: ${redisKey}`);
    } catch (redisError) {
      console.warn('⚠️ Redis store failed (non-critical):', redisError.message);
      // Continue - we can still return preview data
    }

    // Return preview data
    return NextResponse.json({
      success: true,
      ...previewData,
    });
  } catch (error) {
    console.error('❌ Microsoft email preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate email preview',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
