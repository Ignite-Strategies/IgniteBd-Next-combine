import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { takeCrmClientEmailAndParseAiService } from '@/lib/services/takeCrmClientEmailAndParseAiService';

/**
 * POST /api/inbound-email
 *
 * SendGrid Inbound Parse webhook endpoint.
 * 
 * This endpoint receives POST requests from SendGrid Inbound Parse when emails
 * are forwarded to your configured receiving address (e.g., {companySlug}@crm.ignitestrategies.co).
 * SendGrid sends multipart/form-data with parsed email fields.
 * 
 * Flow:
 * 1. Extract company slug from recipient address
 * 2. Validate slug exists
 * 3. Create email_activities record with emailRawText (all other fields null initially)
 * 4. Trigger AI parsing (async)
 * 5. Update record with parsed fields
 * 6. Handle response detection and threading
 * 7. Update contact nextEngagementDate
 * 
 * This endpoint is public and does not require authentication (webhook-safe).
 */
export async function POST(request: Request) {
  try {
    // Parse multipart/form-data from SendGrid
    const formData = await request.formData();

    // Extract email fields
    const from = typeof formData.get('from') === 'string' ? formData.get('from') as string : '';
    const to = typeof formData.get('to') === 'string' ? formData.get('to') as string : '';
    const subject = typeof formData.get('subject') === 'string' ? formData.get('subject') as string : '';
    const text = typeof formData.get('text') === 'string' ? formData.get('text') as string : '';
    const html = typeof formData.get('html') === 'string' ? formData.get('html') as string : '';
    const headers = typeof formData.get('headers') === 'string' ? formData.get('headers') as string : '';

    console.log('[inbound-email] Received webhook:', {
      from,
      to,
      subject: subject.substring(0, 50),
      hasText: !!text,
      hasHtml: !!html,
    });

    // Extract company slug from recipient address
    // Pattern: {companySlug}@crm.ignitestrategies.co
    // SendGrid may send multiple "to" addresses, so handle comma-separated or just first match
    const toAddresses = to.split(',').map(addr => addr.trim());
    let companySlug: string | null = null;
    
    for (const toAddr of toAddresses) {
      const slugMatch = toAddr.match(/^([^@]+)@crm\.(.+)$/);
      if (slugMatch) {
        companySlug = slugMatch[1].toLowerCase().trim();
        break;
      }
    }

    if (!companySlug) {
      console.error('[inbound-email] Invalid recipient address format:', { to, toAddresses });
      return NextResponse.json(
        { success: false, error: 'Invalid recipient address format' },
        { status: 400 }
      );
    }

    console.log('[inbound-email] Extracted slug:', companySlug);

    // Validate slug exists in company_hqs
    const company = await prisma.company_hqs.findUnique({
      where: { slug: companySlug },
      select: { id: true, ownerId: true, companyName: true, slug: true },
    });

    if (!company) {
      // Try to find by company name as fallback (for debugging)
      const companiesWithSlug = await prisma.company_hqs.findMany({
        where: {
          companyName: { contains: 'BusinessPoint', mode: 'insensitive' },
        },
        select: { id: true, companyName: true, slug: true },
        take: 5,
      });
      
      console.error('[inbound-email] Company slug not found:', {
        requestedSlug: companySlug,
        foundCompanies: companiesWithSlug,
      });
      
      return NextResponse.json(
        { success: false, error: `Company slug not found: "${companySlug}"` },
        { status: 400 }
      );
    }

    console.log('[inbound-email] Found company:', {
      id: company.id,
      name: company.companyName,
      slug: company.slug,
    });

    // Get owner ID (from company or fallback)
    const ownerId = company.ownerId || process.env.INBOUND_EMAIL_OWNER_ID || null;
    if (!ownerId) {
      console.error('[inbound-email] No owner found for company:', company.id);
      return NextResponse.json(
        { success: false, error: 'Company has no owner configured' },
        { status: 503 }
      );
    }

    // Use text or html as raw email content
    const emailRawText = text || html || '';

    // Create email_activities record (everything null except emailRawText and routing fields)
    const emailActivity = await prisma.email_activities.create({
      data: {
        owner_id: ownerId,
        tenant_id: company.id,
        emailRawText,
        emailSequenceOrder: 'CONTACT_SEND',
        source: 'OFF_PLATFORM',
        platform: 'sendgrid_inbound',
        // All other fields null initially
        contact_id: null,
        email: null,
        subject: null,
        body: null,
        event: null,
        messageId: null,
      },
    });

    console.log('[inbound-email] Created email_activities record:', {
      id: emailActivity.id,
      companySlug,
      tenantId: company.id,
    });

    // Return success immediately (non-blocking)
    // Process AI parsing asynchronously
    processEmailParsing(emailActivity.id, emailRawText, headers, company.id, ownerId).catch(err => {
      console.error('[inbound-email] Error processing email parsing:', err);
      // Don't throw - email already saved
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    // Gracefully handle errors
    console.error('[inbound-email] Error processing webhook:', error);
    // Return 200 to SendGrid even on error (prevent retries)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 200 }
    );
  }
}

/**
 * Process email parsing asynchronously
 */
async function processEmailParsing(
  emailActivityId: string,
  emailRawText: string,
  headers: string,
  tenantId: string,
  ownerId: string
) {
  try {
    // Parse email with AI
    const parsed = await takeCrmClientEmailAndParseAiService(emailRawText, headers);

    // Match contact by email
    let contactId: string | null = null;
    if (parsed.contactEmail) {
      const normalizedEmail = parsed.contactEmail.toLowerCase().trim();
      const contact = await prisma.contact.findUnique({
        where: {
          email_crmId: {
            email: normalizedEmail,
            crmId: tenantId,
          },
        },
        select: { id: true },
      });
      contactId = contact?.id || null;
    }

    // Update email_activities with parsed fields
    await prisma.email_activities.update({
      where: { id: emailActivityId },
      data: {
        subject: parsed.subject || null,
        body: parsed.body || null,
        email: parsed.contactEmail || null,
        contact_id: contactId,
      },
    });

    // Handle response detection and threading
    if (parsed.inReplyTo) {
      await handleResponseDetection(emailActivityId, parsed.inReplyTo, tenantId, contactId);
    }

    // Handle next engagement date
    if (contactId) {
      if (parsed.inReplyTo) {
        // Response: set nextEngagementDate = today + 7 days
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
        const nextEngagementDate = oneWeekFromNow.toISOString().slice(0, 10); // "YYYY-MM-DD"

        await prisma.contact.update({
          where: { id: contactId },
          data: {
            nextEngagementDate,
            nextEngagementPurpose: 'PERIODIC_CHECK_IN',
          },
        });
      } else if (parsed.nextEngagementDate) {
        // New action: use parsed date
        await prisma.contact.update({
          where: { id: contactId },
          data: {
            nextEngagementDate: parsed.nextEngagementDate,
          },
        });
      }
    }

    console.log('[inbound-email] Email parsed and updated:', {
      emailActivityId,
      contactId,
      isResponse: !!parsed.inReplyTo,
    });
  } catch (error) {
    console.error('[inbound-email] Error in processEmailParsing:', error);
    // Don't throw - email already saved with emailRawText
  }
}

/**
 * Handle response detection and threading
 * Matches existing off-platform-conversation pattern
 */
async function handleResponseDetection(
  newInboundEmailId: string,
  inReplyToMessageId: string,
  tenantId: string,
  contactId: string | null
) {
  try {
    // Find original email by messageId
    const original = await prisma.email_activities.findFirst({
      where: {
        messageId: inReplyToMessageId,
        tenant_id: tenantId,
      },
      select: { id: true },
    });

    if (!original) {
      console.log('[inbound-email] Original email not found for messageId:', inReplyToMessageId);
      return;
    }

    // Update PARENT row: stamp it with response id (existing pattern)
    await prisma.email_activities.update({
      where: { id: original.id },
      data: {
        responseFromEmail: newInboundEmailId,  // Parent stores response id
        event: 'sent',  // Proof email went out
      },
    });

    console.log('[inbound-email] Linked response:', {
      originalId: original.id,
      responseId: newInboundEmailId,
    });
  } catch (error) {
    console.error('[inbound-email] Error in handleResponseDetection:', error);
    // Don't throw - continue processing
  }
}

/**
 * Handle unsupported HTTP methods
 */
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. This endpoint only accepts POST requests.' },
    { status: 405 }
  );
}
