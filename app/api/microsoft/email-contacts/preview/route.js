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
    function isAutomatedEmail(email, displayName) {
      const emailLower = email.toLowerCase();
      const nameLower = (displayName || '').toLowerCase().trim();
      
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
      
      // If no display name or display name is just the email, skip business name check
      if (!displayName || nameLower === emailLower || nameLower.length === 0) {
        // Continue to domain check below
      } else {
        // Check if displayName looks like a business name (not a person name)
        // Person names: "John Smith", "Mary", "Robert Johnson"
        // Business names: "QuickBooks", "Acme Corp", "Tech Solutions Inc"
        
        const words = nameLower.split(/\s+/).filter(w => w.length > 0);
        
        // Single word that's not a common first name = likely business
        if (words.length === 1) {
          const word = words[0];
          // Common first names (allow these - might be a person)
          const commonFirstNames = new Set([
            'alex', 'chris', 'dana', 'jordan', 'kelly', 'morgan', 'pat', 'robin', 'sam', 'taylor',
            'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas',
            'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah',
            'emily', 'emma', 'sophia', 'olivia', 'ava', 'mia', 'chloe', 'ella', 'avery', 'sofia',
          ]);
          
          // If it's a common first name, allow it
          if (!commonFirstNames.has(word) && word.length > 4) {
            // Single word, not a common name, longer than 4 chars = likely business
            return true;
          }
        }
        
        // Multiple words: check for business indicators
        if (words.length >= 2) {
          // Business indicators (Inc, LLC, Corp, etc.)
          const businessIndicators = ['inc', 'llc', 'corp', 'ltd', 'co', 'company', 'solutions', 
            'services', 'systems', 'group', 'associates', 'partners', 'enterprises', 'industries',
            'technologies', 'consulting', 'advisory', 'capital', 'ventures', 'holdings'];
          
          // Check if any word is a business indicator
          if (words.some(word => businessIndicators.includes(word))) {
            return true;
          }
          
          // Check capitalization pattern in original displayName (not lowercased)
          // Business names often have unusual capitalization: "QuickBooks", "Stripe Inc"
          const originalWords = (displayName || '').split(/\s+/).filter(w => w.length > 0);
          if (originalWords.length >= 2) {
            // Check if all words start with capital (business name pattern)
            const allStartWithCapital = originalWords.every(word => 
              word.length > 0 && /^[A-Z]/.test(word)
            );
            
            // Common name words (exception for real people)
            const commonNameWords = new Set([
              'john', 'jane', 'mary', 'james', 'robert', 'michael', 'william', 'david',
              'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis',
            ]);
            
            // If all words start with capital and none are common names, likely business
            if (allStartWithCapital && !words.some(word => commonNameWords.has(word))) {
              return true;
            }
          }
        }
      }
      
      // Common automated/business domains (using Set for O(1) lookup)
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
      ]);
      
      const domain = emailLower.split('@')[1];
      // Check exact domain match
      if (automatedDomains.has(domain)) {
        return true;
      }
      // Check if domain ends with any automated domain (catches subdomains)
      for (const automatedDomain of automatedDomains) {
        if (domain.endsWith('.' + automatedDomain)) {
          return true;
        }
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
        /^quickbooks/i,  // Matches "QuickBooks", "QuickBooks Online", etc.
        /^intuit/i,      // Matches "Intuit", "Intuit QuickBooks", etc.
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
      
      // Check if displayName looks like a business name (not a person name)
      // Person names typically: "John Smith", "Mary", "Robert Johnson"
      // Business names: "QuickBooks", "Acme Corp", "Tech Solutions Inc"
      const looksLikeBusinessName = () => {
        if (!nameLower || nameLower.length === 0) {
          return false; // No name to check
        }
        
        const words = nameLower.split(/\s+/).filter(w => w.length > 0);
        
        // Single word that's not a common first name = likely business
        if (words.length === 1) {
          const word = words[0];
          // Common first names (allow these)
          const commonFirstNames = new Set([
            'alex', 'chris', 'dana', 'jordan', 'kelly', 'morgan', 'pat', 'robin', 'sam', 'taylor',
            'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas',
            'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah',
            'emily', 'emma', 'sophia', 'olivia', 'ava', 'mia', 'chloe', 'ella', 'avery', 'sofia',
          ]);
          
          // If it's a common first name, allow it
          if (commonFirstNames.has(word)) {
            return false;
          }
          
          // Single word that's longer than 4 chars and not a common name = likely business
          if (word.length > 4) {
            return true;
          }
        }
        
        // Multiple words: check if it looks like a business
        if (words.length >= 2) {
          // Business indicators in names
          const businessIndicators = ['inc', 'llc', 'corp', 'ltd', 'co', 'company', 'solutions', 
            'services', 'systems', 'group', 'associates', 'partners', 'enterprises', 'industries',
            'technologies', 'consulting', 'advisory', 'capital', 'ventures', 'holdings'];
          
          // Check if any word is a business indicator
          if (words.some(word => businessIndicators.includes(word))) {
            return true;
          }
          
          // Check if all words are capitalized (like "QuickBooks Online", "Stripe Inc")
          // This is a heuristic: business names often have unusual capitalization
          const allWordsCapitalized = words.every(word => {
            return word.length > 0 && (
              /^[A-Z]/.test(word) || // Starts with capital
              word === word.toUpperCase() || // All caps
              word.length <= 2 // Abbreviation
            );
          });
          
          // If all words are capitalized and it's not a common name pattern, likely business
          if (allWordsCapitalized && words.length >= 2) {
            // Exception: common name patterns like "John Smith" (two common words)
            const commonNameWords = new Set([
              'john', 'jane', 'mary', 'james', 'robert', 'michael', 'william', 'david',
              'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis',
            ]);
            const hasCommonNameWords = words.some(word => commonNameWords.has(word));
            
            if (!hasCommonNameWords) {
              return true; // All capitalized, no common names = likely business
            }
          }
        }
        
        return false;
      };
      
      if (looksLikeBusinessName()) {
        return true;
      }
      
      return false;
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
