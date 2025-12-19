import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken } from '@/lib/microsoftGraphClient';
import { storeMicrosoftContactPreview } from '@/lib/redis';

/**
 * POST /api/microsoft/contacts/preview/contacts
 * 
 * Fetch Outlook contacts (address book) and extract contact signals
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
 *       "lastSeenAt": null,
 *       "messageCount": 0
 *     }
 *   ],
 *   "source": "contacts"
 * }
 * 
 * Stores in Redis:
 * - Raw Microsoft Graph contacts under redisKey
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

    // Fetch contacts from Microsoft Graph
    const graphUrl = 'https://graph.microsoft.com/v1.0/me/contacts?$top=1000&$select=displayName,emailAddresses,companyName,jobTitle';
    
    let contactsResponse;
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

      contactsResponse = await response.json();
    } catch (error) {
      console.error('❌ Microsoft Graph API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch contacts from Microsoft Graph',
          details: error.message,
        },
        { status: 500 }
      );
    }

    const contacts = contactsResponse.value || [];

    // Transform contacts to ContactCandidate format
    const outlookContacts = [];

    for (const contact of contacts) {
      // Get primary email address
      const emailAddresses = contact.emailAddresses || [];
      const primaryEmail = emailAddresses.find(addr => addr.type === 'personal' || addr.type === 'work') 
        || emailAddresses[0];

      if (!primaryEmail || !primaryEmail.address) {
        continue;
      }

      const email = primaryEmail.address.toLowerCase().trim();
      if (!email || !email.includes('@')) {
        continue;
      }

      const displayName = contact.displayName || email.split('@')[0];
      const domain = email.split('@')[1];

      outlookContacts.push({
        email,
        displayName,
        domain,
        lastSeenAt: null, // Contacts don't have lastSeenAt
        messageCount: 0, // Contacts don't have message count
      });
    }

    // Generate preview ID
    const previewId = `preview:${Date.now()}:${Math.random().toString(36).substring(7)}`;

    // Store in Redis
    let redisKey;
    try {
      redisKey = await storeMicrosoftContactPreview(
        previewId,
        outlookContacts,
        contactsResponse
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
      source: 'contacts',
      message: 'Contact signals extracted from contacts successfully. Use previewId to retrieve data.',
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
