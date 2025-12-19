import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken } from '@/lib/microsoftGraphClient';
import { storeMicrosoftContactPreview } from '@/lib/redis';

/**
 * POST /api/microsoft/contacts/preview/messages
 * 
 * Fetch Outlook messages and extract contact signals from people you email
 * 
 * Returns:
 * {
 *   "previewId": "preview:123:abc",
 *   "redisKey": "microsoft:preview:123:abc",
 *   "contactCandidates": [
 *     {
 *       "email": "user@example.com",
 *       "displayName": "John Doe",
 *       "domain": "example.com",
 *       "lastSeenAt": "2025-01-27T10:00:00Z",
 *       "messageCount": 5
 *     }
 *   ],
 *   "source": "messages"
 * }
 * 
 * Stores in Redis:
 * - Raw Microsoft Graph messages under redisKey
 * - Normalized contactCandidates under previewId
 * 
 * NO database writes - this is preview only
 */
export async function POST(request) {
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

    // Fetch messages from Microsoft Graph
    const graphUrl = 'https://graph.microsoft.com/v1.0/me/messages?$select=from,receivedDateTime&$top=25&$orderby=receivedDateTime desc';
    
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

    // Transform messages to ContactCandidate format
    // Group by email address and aggregate message count + most recent date
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

      if (contactMap.has(email)) {
        const existing = contactMap.get(email);
        existing.messageCount += 1;
        // Update lastSeenAt if this message is more recent
        if (receivedDateTime && (!existing.lastSeenAt || receivedDateTime > existing.lastSeenAt)) {
          existing.lastSeenAt = receivedDateTime;
        }
      } else {
        contactMap.set(email, {
          email,
          displayName,
          domain,
          lastSeenAt: receivedDateTime || new Date().toISOString(),
          messageCount: 1,
        });
      }
    }

    // Convert map to array (outlookContacts)
    const outlookContacts = Array.from(contactMap.values());

    // Generate preview ID
    const previewId = `preview:${Date.now()}:${Math.random().toString(36).substring(7)}`;

    // Store in Redis
    let redisKey;
    try {
      redisKey = await storeMicrosoftContactPreview(
        previewId,
        outlookContacts,
        messagesResponse
      );
      console.log(`✅ Microsoft contact preview stored: ${previewId}`);
    } catch (redisError) {
      console.warn('⚠️ Redis store failed (non-critical):', redisError.message);
      // Continue - we can still return preview data
      redisKey = `microsoft:${previewId}`;
    }

    // Return preview data
    return NextResponse.json({
      success: true,
      previewId,
      redisKey,
      contactCandidates: outlookContacts,
      source: 'messages',
      message: 'Contact signals extracted from messages successfully. Use previewId to retrieve data.',
    });
  } catch (error) {
    console.error('❌ Microsoft contact preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate contact preview',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
