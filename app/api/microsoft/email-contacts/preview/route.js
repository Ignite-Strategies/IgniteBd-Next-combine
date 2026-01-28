import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken } from '@/lib/microsoftGraphClient';
import crypto from 'crypto';

/**
 * GET /api/microsoft/email-contacts/preview
 * 
 * Fetch and aggregate email senders from Microsoft Graph messages
 * Returns preview of unique people from email metadata
 * 
 * Query Parameters:
 * - skip: Number of messages to skip (default: 0)
 *   Examples: skip=0 (messages 1-100), skip=100 (messages 101-200), skip=200 (messages 201-300)
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
 * - Fetches 100 messages starting from skip position
 * - Processes and filters to return up to 50 unique contacts
 * - No caching - always fresh data
 * - Simple pagination: skip=0, skip=100, skip=200, etc.
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

    // Fetch messages from Microsoft Graph with skip parameter for pagination
    // skip=0 → messages 1-100, skip=100 → messages 101-200, skip=200 → messages 201-300, etc.
    const graphUrl = `https://graph.microsoft.com/v1.0/me/messages?$select=from,receivedDateTime&$top=100&$skip=${skip}&$orderby=receivedDateTime desc`;
    
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
    // Simple heuristic: Keep people (first + last name), filter businesses
    function isAutomatedEmail(email, displayName) {
      const emailLower = email.toLowerCase();
      const nameLower = (displayName || '').toLowerCase().trim();
      
      // Filter out emails containing these keywords in the email address
      const emailKeywords = ['mail', 'subscriptions', 'subscription', 'team', 'noreply', 'no-reply'];
      if (emailKeywords.some(keyword => emailLower.includes(keyword))) {
        return true;
      }
      
      // Filter out anything with hyphens in email or display name
      if (emailLower.includes('-') || (displayName && displayName.includes('-'))) {
        return true;
      }
      
      // Common automated email patterns (definitely filter these)
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
      ];
      
      // Check email patterns first
      if (automatedPatterns.some(pattern => pattern.test(emailLower))) {
        return true;
      }
      
      // Common automated/business domains (definitely filter these)
      const automatedDomains = new Set([
        'sendgrid.com', 'sendgrid.net', 'mail.sendgrid.net',
        'godaddy.com',
        'venmo.com', 'email.venmo.com',
        'bluevine.com', 'email.bluevine.com',
        'stripe.com', 'mail.stripe.com',
        'paypal.com', 'mail.paypal.com',
        'amazon.com', 'amazonaws.com', 'mail.amazon.com',
        'github.com', 'noreply.github.com',
        'linkedin.com', 'notifications.linkedin.com',
        'facebook.com', 'mail.facebook.com',
        'twitter.com', 'x.com', 'mail.x.com',
        'google.com', 'mail.google.com',
        'microsoft.com', 'mail.microsoft.com',
        'outlook.com', 'mail.outlook.com',
        'mailchimp.com', 'mail.mailchimp.com',
        'hubspot.com', 'mail.hubspot.com',
        'salesforce.com', 'mail.salesforce.com',
        'zendesk.com', 'mail.zendesk.com',
        'intercom.com', 'mail.intercom.com',
        'slack.com', 'mail.slack.com',
        'dropbox.com', 'mail.dropbox.com',
        'zoom.us', 'mail.zoom.us',
        'calendly.com', 'mail.calendly.com',
        'eventbrite.com', 'mail.eventbrite.com',
        'square.com', 'mail.square.com',
        'quickbooks.com', 'mail.quickbooks.com', 'intuit.com', 'mail.intuit.com', 'quickbooks.intuit.com',
        'xero.com', 'mail.xero.com',
        'freshbooks.com', 'mail.freshbooks.com',
        'substack.com', // Filter Substack newsletters
        'ebay.com', 'info.ebay.com', // Filter eBay
        'wix.com', 'wixsite.com', // Filter Wix
        'adobe.com', // Filter Adobe (mail@mail.adobe.com)
        'businessinsider.com', // Filter Business Insider
      ]);
      
      const domain = emailLower.split('@')[1];
      if (automatedDomains.has(domain)) {
        return true;
      }
      // Check if domain ends with any automated domain (catches subdomains)
      for (const automatedDomain of automatedDomains) {
        if (domain.endsWith('.' + automatedDomain)) {
          return true;
        }
      }
      
      // SIMPLE HEURISTIC: If displayName can be parsed into firstName + lastName, keep it
      // Otherwise, filter it as a business
      if (!displayName || nameLower === emailLower || nameLower.length === 0) {
        // No display name or just email = likely automated/business
        return true;
      }
      
      const words = nameLower.split(/\s+/).filter(w => w.length > 0);
      
      // If it's 2 words (firstName lastName), keep it - it's a person!
      if (words.length === 2) {
        // Check if both words look like names (not business indicators)
        const businessIndicators = ['inc', 'llc', 'corp', 'ltd', 'co', 'company', 'solutions', 
          'services', 'systems', 'group', 'associates', 'partners', 'enterprises', 'industries',
          'technologies', 'consulting', 'advisory', 'capital', 'ventures', 'holdings'];
        
        // If neither word is a business indicator, it's probably a person name
        const hasBusinessIndicator = words.some(word => businessIndicators.includes(word));
        if (!hasBusinessIndicator) {
          return false; // Keep it - looks like "FirstName LastName"
        }
      }
      
      // If it's 1 word, might be a person (common first name) or business
      if (words.length === 1) {
        const word = words[0];
        // Common first names (allow these - might be a person)
        const commonFirstNames = new Set([
          'alex', 'chris', 'dana', 'jordan', 'kelly', 'morgan', 'pat', 'robin', 'sam', 'taylor',
          'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas',
          'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah',
          'emily', 'emma', 'sophia', 'olivia', 'ava', 'mia', 'chloe', 'ella', 'avery', 'sofia',
          'joel', 'adam', 'daniel', 'matthew', 'mark', 'luke', 'paul', 'peter', 'andrew', 'steven',
        ]);
        
        if (commonFirstNames.has(word)) {
          return false; // Keep it - common first name
        }
        
        // Single word, not a common name, longer than 4 chars = likely business
        if (word.length > 4) {
          return true;
        }
      }
      
      // 3+ words or has business indicators = likely business
      if (words.length >= 3) {
        return true;
      }
      
      // Default: if we can't confidently say it's a person, filter it
      return true;
    }

    // Aggregate messages into unique people by email address
    // Early exit when we have 50 unique contacts to improve performance
    const contactMap = new Map();
    const TARGET_CONTACTS = 50;

    for (const message of messages) {
      // Early exit: if we already have enough unique contacts, stop processing
      if (contactMap.size >= TARGET_CONTACTS) {
        break;
      }

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

      // Generate stable previewId (hash of email) - only if new contact
      let previewId;
      if (!contactMap.has(email)) {
        previewId = crypto.createHash('sha256').update(email).digest('hex').substring(0, 16);
      }

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

    // Convert map to array (already limited to 50 by early exit)
    const items = Array.from(contactMap.values());

    // Prepare preview data - always show 50 (or fewer if we don't have that many unique contacts)
    const previewData = {
      generatedAt: new Date().toISOString(),
      skip,
      limit: 50,
      items,
      hasMore: items.length === 50, // If we got 50, there might be more
    };

    // Return preview data (no caching - always fresh)
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
