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
