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
    // IMPORTANT: Microsoft Graph Contacts API might return contacts without emailAddresses
    // We need to check if there's a nextLink for pagination
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
    const hasNextLink = !!contactsResponse['@odata.nextLink'];
    
    // Debug: Log what we got from Microsoft Graph
    console.log(`📊 Microsoft Graph returned ${contacts.length} contacts (skip=${skip}, hasNextLink=${hasNextLink})`);
    if (contacts.length > 0) {
      console.log(`📊 Sample contacts:`, contacts.slice(0, 3).map(c => ({
        displayName: c.displayName,
        hasEmail: !!(c.emailAddresses && c.emailAddresses.length > 0),
        emailCount: c.emailAddresses?.length || 0,
      })));
    }

    // Filter out automated emails (same comprehensive function as email preview)
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

    // Transform contacts to preview format
    // Process ALL contacts in the batch to ensure pagination consistency
    // Then return up to 50 unique contacts
    const contactMap = new Map();
    let skippedNoEmail = 0;
    let skippedAutomated = 0;

    for (const contact of contacts) {
      const emailAddresses = contact.emailAddresses || [];
      const primaryEmail = emailAddresses.find(addr => addr.type === 'personal' || addr.type === 'work') 
        || emailAddresses[0];

      if (!primaryEmail || !primaryEmail.address) {
        skippedNoEmail++;
        continue;
      }

      const email = primaryEmail.address.toLowerCase().trim();
      if (!email || !email.includes('@')) {
        skippedNoEmail++;
        continue;
      }

      // Skip automated emails
      if (isAutomatedEmail(email, contact.displayName)) {
        skippedAutomated++;
        continue;
      }

      // Skip if we already have this email (duplicate within batch)
      if (contactMap.has(email)) {
        continue;
      }

      const displayName = contact.displayName || email.split('@')[0];
      const domain = email.split('@')[1];

      // Generate stable previewId (hash of email)
      const previewId = crypto.createHash('sha256').update(email).digest('hex').substring(0, 16);

      contactMap.set(email, {
        previewId,
        email,
        displayName: displayName !== email ? displayName : undefined,
        domain,
        companyName: contact.companyName || null,
        jobTitle: contact.jobTitle || null,
      });
    }

    // Convert map to array and take first 50
    const allItems = Array.from(contactMap.values());
    const items = allItems.slice(0, 50);
    
    // Debug: Log filtering stats
    console.log(`📊 Contacts filtering stats (skip=${skip}):`);
    console.log(`  - Total from Graph: ${contacts.length}`);
    console.log(`  - Skipped (no email): ${skippedNoEmail}`);
    console.log(`  - Skipped (automated): ${skippedAutomated}`);
    console.log(`  - Unique contacts found: ${allItems.length}`);
    console.log(`  - Returning: ${items.length}`);
    console.log(`  - Note: "Already Exists" check happens in review step`);

    // Prepare preview data
    // hasMore: true if we got a full batch (200) OR if there's a nextLink from Graph API
    const previewData = {
      generatedAt: new Date().toISOString(),
      skip,
      limit: 50,
      items,
      hasMore: hasNextLink || (contacts.length === 200 && allItems.length >= 50), // If Graph has more OR we got full batch with 50+ items
      source: 'contacts', // Indicates this is from Microsoft Contacts, not email messages
      debug: {
        totalFromGraph: contacts.length,
        hasNextLink,
        skippedNoEmail,
        skippedAutomated,
        uniqueContacts: allItems.length,
        returned: items.length,
      },
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

