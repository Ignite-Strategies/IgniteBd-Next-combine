import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { takeCrmClientEmailAndParseAiService } from '@/lib/services/takeCrmClientEmailAndParseAiService';
import { extractCompanySlugFromAddress, parseEmailAddresses } from '@/lib/utils/parseEmailAddress';

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

    // Log ALL fields SendGrid sent (for debugging forwarded emails)
    const allFields: Record<string, string | number> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        allFields[key] = value.length > 200 ? `${value.substring(0, 200)}... (${value.length} chars)` : value;
      } else {
        allFields[key] = `[File/Blob: ${value instanceof File ? value.size + ' bytes' : 'unknown'}]`;
      }
    }
    console.log('[inbound-email] All SendGrid fields received:', Object.keys(allFields));
    console.log('[inbound-email] Field sizes:', Object.fromEntries(
      Object.entries(allFields).map(([k, v]) => [k, typeof v === 'string' ? v.length : 'N/A'])
    ));

    // Extract email fields
    const from = typeof formData.get('from') === 'string' ? formData.get('from') as string : '';
    const to = typeof formData.get('to') === 'string' ? formData.get('to') as string : '';
    const subject = typeof formData.get('subject') === 'string' ? formData.get('subject') as string : '';
    const text = typeof formData.get('text') === 'string' ? formData.get('text') as string : '';
    const html = typeof formData.get('html') === 'string' ? formData.get('html') as string : '';
    const headers = typeof formData.get('headers') === 'string' ? formData.get('headers') as string : '';
    
    // Check for other possible fields SendGrid might send
    const envelope = typeof formData.get('envelope') === 'string' ? formData.get('envelope') as string : '';
    const spamReport = typeof formData.get('spam_report') === 'string' ? formData.get('spam_report') as string : '';
    const charsets = typeof formData.get('charsets') === 'string' ? formData.get('charsets') as string : '';
    
    // Log what we got
    console.log('[inbound-email] Content fields:', {
      textLength: text.length,
      htmlLength: html.length,
      headersLength: headers.length,
      envelopeLength: envelope.length,
      hasEnvelope: !!envelope,
    });

    // Parse email addresses from SendGrid payload
    const parsedToAddresses = parseEmailAddresses(to);
    const parsedFromAddresses = parseEmailAddresses(from);
    
    console.log('[inbound-email] Received webhook:', {
      from,
      to,
      parsedFromAddresses,
      parsedToAddresses,
      subject: subject.substring(0, 50),
      hasText: !!text,
      hasHtml: !!html,
    });

    // Extract company slug from recipient address using email parser
    // Pattern: {companySlug}@crm.ignitestrategies.co
    const companySlug = extractCompanySlugFromAddress(to);

    if (!companySlug) {
      console.error('[inbound-email] Invalid recipient address format - no slug found:', {
        to,
        parsedToAddresses,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid recipient address format - no company slug found' },
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
    // For forwarded emails, SendGrid might not extract body properly
    // Build raw email from available parts
    let emailRawText = text || html || '';
    
    // If no body extracted, try to reconstruct from headers + envelope
    // Headers might contain the full raw email for forwarded messages
    if (!emailRawText) {
      console.log('[inbound-email] No text/html body — reconstructing from headers/envelope');
      // Build a raw email-like string from what we have
      const parts: string[] = [];
      if (headers) parts.push(`Headers:\n${headers}`);
      if (envelope) parts.push(`Envelope: ${envelope}`);
      if (from) parts.push(`From: ${from}`);
      if (to) parts.push(`To: ${to}`);
      if (subject) parts.push(`Subject: ${subject}`);
      emailRawText = parts.join('\n\n');
      console.log('[inbound-email] Reconstructed raw email length:', emailRawText.length);
    }

    // If still no content, log warning
    if (!emailRawText) {
      console.warn('[inbound-email] No body content (hasText: false, hasHtml: false, headers empty) — parser will have nothing to work with');
      console.warn('[inbound-email] Available fields:', {
        hasText: !!text,
        hasHtml: !!html,
        hasHeaders: !!headers,
        hasEnvelope: !!envelope,
        allFieldKeys: Object.keys(allFields),
      });
    }

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
    // Process AI parsing asynchronously (pass from/to for fallback contact matching)
    processEmailParsing(
      emailActivity.id, 
      emailRawText, 
      headers, 
      company.id, 
      ownerId,
      parsedFromAddresses[0] || null, // Pass from email for fallback
      subject // Pass subject for fallback
    ).catch(err => {
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
  ownerId: string,
  fromEmail: string | null = null, // Fallback: from address from webhook
  subject: string | null = null // Fallback: subject from webhook
) {
  try {
    // If no body, log what we're working with
    if (!emailRawText) {
      console.log('[inbound-email] Parsing with empty body — will extract from headers only');
      console.log('[inbound-email] Headers available:', headers ? headers.substring(0, 200) : 'none');
      console.log('[inbound-email] From email (fallback):', fromEmail);
    }

    // Parse email with AI
    let parsed;
    try {
      parsed = await takeCrmClientEmailAndParseAiService(emailRawText, headers);
    } catch (parseError) {
      const err = parseError instanceof Error ? parseError : new Error(String(parseError));
      console.error('[inbound-email] Parser failed, using fallback:', err.message);
      // Fallback: use from email and subject from webhook
      parsed = {
        subject: subject || '',
        body: '',
        contactEmail: fromEmail || '',
        contactName: null,
        nextEngagementDate: null,
        inReplyTo: null,
        references: null,
        isResponse: false,
      };
    }

    // Log what we parsed (so we can see it in logs)
    console.log('[inbound-email] Parsed result:', {
      contactEmail: parsed.contactEmail || null,
      contactName: parsed.contactName || null,
      subject: parsed.subject ? parsed.subject.substring(0, 60) : null,
      bodyLength: parsed.body?.length ?? 0,
      nextEngagementDate: parsed.nextEngagementDate || null,
      inReplyTo: parsed.inReplyTo ? 'yes' : null,
      isResponse: parsed.isResponse,
    });

    // Match contact by email
    let contactId: string | null = null;
    const contactEmailToMatch = parsed.contactEmail || fromEmail; // Use parsed or fallback
    if (contactEmailToMatch) {
      const normalizedEmail = contactEmailToMatch.toLowerCase().trim();
      const contact = await prisma.contact.findUnique({
        where: {
          email_crmId: {
            email: normalizedEmail,
            crmId: tenantId,
          },
        },
        select: { id: true, fullName: true },
      });
      contactId = contact?.id || null;
      console.log('[inbound-email] Contact match:', {
        lookedUp: normalizedEmail,
        source: parsed.contactEmail ? 'parsed' : 'fallback-from',
        found: contactId ? { id: contact.id, name: contact.fullName } : null,
      });
    } else {
      console.log('[inbound-email] No contactEmail (parsed or fallback) — skipping contact match');
    }

    // Update email_activities with parsed fields (use fallback if parser returned empty)
    await prisma.email_activities.update({
      where: { id: emailActivityId },
      data: {
        subject: parsed.subject || subject || null, // Use parsed or fallback
        body: parsed.body || null,
        email: parsed.contactEmail || fromEmail || null, // Use parsed or fallback
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
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[inbound-email] Parse failed (email saved with emailRawText):', err.message);
    console.error('[inbound-email] Parse error stack:', err.stack);
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
