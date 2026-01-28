import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken } from '@/lib/microsoftGraphClient';
import crypto from 'crypto';

/**
 * GET /api/microsoft/contacts/preview
 * 
 * Fetch Microsoft Contacts (address book) and return preview
 * Similar to email-contacts/preview but uses /me/contacts instead of /me/messages
 * 
 * Query Parameters:
 * - skip: Number of contacts to skip (default: 0)
 *   Examples: skip=0 (contacts 1-50), skip=50 (contacts 51-100), skip=100 (contacts 101-150)
 * 
 * Returns:
 * {
 *   "success": true,
 *   "generatedAt": "ISO_TIMESTAMP",
 *   "skip": 0,
 *   "limit": 50,
 *   "items": [
 *     {
 *       "previewId": "hash_of_email",
 *       "email": "user@example.com",
 *       "displayName": "John Doe",
 *       "domain": "example.com",
 *       "companyName": "Acme Corp",
 *       "jobTitle": "CEO",
 *       "alreadyExists": false
 *     }
 *   ],
 *   "hasMore": true
 * }
 * 
 * Behavior:
 * - Fetches 200 contacts starting from skip position
 * - Processes and filters to return up to 50 unique contacts
 * - No caching - always fresh data
 * - Simple pagination: skip=0, skip=50, skip=100, etc.
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

    // Get skip parameter from query string (default: 0)
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get('skip') || '0', 10);

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

    // Fetch contacts from Microsoft Graph with skip parameter for pagination
    // skip=0 → contacts 1-200, skip=200 → contacts 201-400, etc.
    // Note: Microsoft Graph Contacts API uses $skip for pagination
    const graphUrl = `https://graph.microsoft.com/v1.0/me/contacts?$top=200&$skip=${skip}&$select=displayName,emailAddresses,companyName,jobTitle`;
    
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

    // Filter out automated emails (same function as email preview)
    function isAutomatedEmail(email, displayName) {
      const emailLower = email.toLowerCase();
      const nameLower = (displayName || '').toLowerCase();
      
      const automatedPatterns = [
        /^noreply@/i,
        /^no-reply@/i,
        /^donotreply@/i,
        /^automated@/i,
        /^system@/i,
        /^notification@/i,
      ];
      
      if (automatedPatterns.some(pattern => pattern.test(emailLower))) {
        return true;
      }
      
      const automatedDomains = [
        'sendgrid.com',
        'godaddy.com',
        'venmo.com',
        'email.venmo.com',
        'bluevine.com',
        'email.bluevine.com',
      ];
      
      const domain = emailLower.split('@')[1];
      if (automatedDomains.includes(domain)) {
        return true;
      }
      
      return false;
    }

    // Get all existing contact emails for this owner's companies
    // Check which contacts already exist in database
    const companyHQIds = await prisma.company_memberships.findMany({
      where: { userId: owner.id },
      select: { companyHqId: true },
    }).then(memberships => memberships.map(m => m.companyHqId));

    const existingContacts = companyHQIds.length > 0
      ? await prisma.contact.findMany({
          where: {
            crmId: { in: companyHQIds },
            email: { not: null },
          },
          select: {
            email: true,
          },
        })
      : [];

    const existingEmails = new Set(
      existingContacts.map(c => c.email?.toLowerCase().trim()).filter(Boolean)
    );

    // Transform contacts to preview format
    const contactMap = new Map();

    for (const contact of contacts) {
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

      // Skip automated emails
      if (isAutomatedEmail(email, contact.displayName)) {
        continue;
      }

      const displayName = contact.displayName || email.split('@')[0];
      const domain = email.split('@')[1];

      // Generate stable previewId (hash of email)
      const previewId = crypto.createHash('sha256').update(email).digest('hex').substring(0, 16);

      // Check if already exists
      const alreadyExists = existingEmails.has(email);

      contactMap.set(email, {
        previewId,
        email,
        displayName: displayName !== email ? displayName : undefined,
        domain,
        companyName: contact.companyName || null,
        jobTitle: contact.jobTitle || null,
        alreadyExists,
      });
    }

    // Convert map to array and take first 50
    const allItems = Array.from(contactMap.values());
    const items = allItems.slice(0, 50);

    // Prepare preview data
    const previewData = {
      generatedAt: new Date().toISOString(),
      skip,
      limit: 50,
      items,
      hasMore: items.length === 50, // If we got 50, there might be more
      source: 'contacts', // Indicates this is from Microsoft Contacts, not email messages
    };

    // Return preview data (no caching - always fresh)
    return NextResponse.json({
      success: true,
      ...previewData,
    });
  } catch (error) {
    console.error('❌ Microsoft contacts preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate contacts preview',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

