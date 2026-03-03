import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractCompanySlugFromAddress } from '@/lib/utils/parseEmailAddress';

/**
 * POST /api/inbound-email
 *
 * SendGrid Inbound Parse webhook endpoint - MVP1 Ingestion Only
 * 
 * Architecture:
 * SendGrid → InboundEmail (raw ingestion bucket) → Future async processor → EmailActivity
 * 
 * This endpoint is public and does not require authentication (webhook-safe).
 * 
 * MVP1: Ingestion only. No processing, no AI parsing, no contact linking.
 * Company scoping: Extract slug from 'to' field for filtering.
 */
export async function POST(req: Request) {
  try {
    // STEP 1: Extract formData (multipart/form-data from SendGrid)
    const formData = await req.formData();

    // DEBUG: Log ALL fields SendGrid sends (to diagnose forwarded email issues)
    const allFields: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        allFields[key] = value.length > 200 ? `${value.substring(0, 200)}... (${value.length} chars)` : value;
      } else if (value instanceof File) {
        allFields[key] = `[File: ${value.name}, ${value.size} bytes, ${value.type}]`;
      } else {
        allFields[key] = String(value);
      }
    }
    console.log('========================================');
    console.log('🔍 SendGrid Inbound Parse - ALL FIELDS');
    console.log('========================================');
    console.log('Field keys:', Object.keys(allFields));
    console.log('Field values:', JSON.stringify(allFields, null, 2));
    console.log('========================================');

    // STEP 2: Extract SendGrid fields (exact match, case-sensitive)
    // Core fields (always expected)
    const from = (formData.get('from') as string | null) || null;
    const to = (formData.get('to') as string | null) || null;
    const subject = (formData.get('subject') as string | null) || null;
    const text = (formData.get('text') as string | null) || null;
    const html = (formData.get('html') as string | null) || null;
    const headers = (formData.get('headers') as string | null) || null;
    
    // Additional SendGrid fields
    const sender_ip = (formData.get('sender_ip') as string | null) || null;
    const envelope = (formData.get('envelope') as string | null) || null;
    const dkim = (formData.get('dkim') as string | null) || null;
    const SPF = (formData.get('SPF') as string | null) || null; // Case-sensitive!
    const spam_score = (formData.get('spam_score') as string | null) || null;
    const spam_report = (formData.get('spam_report') as string | null) || null;
    const charsets = (formData.get('charsets') as string | null) || null;
    const attachments = (formData.get('attachments') as string | null) || null;
    const attachment_info = (formData.get('attachment-info') as string | null) || null; // Note: hyphenated key
    const raw = (formData.get('raw') as string | null) || null; // Only if "Include Raw" enabled

    // Log what we extracted
    console.log('Extracted SendGrid fields:', {
      from: from || '(empty)',
      to: to || '(empty)',
      subject: subject || '(empty)',
      textLength: text?.length || 0,
      htmlLength: html?.length || 0,
      headersLength: headers?.length || 0,
      sender_ip: sender_ip || '(empty)',
      hasRaw: !!raw,
      rawLength: raw?.length || 0,
    });

    // STEP 3: Extract company slug and resolve companyHQId (company-scoped like rest of repo)
    // Pattern: {companySlug}@crm.ignitestrategies.co
    let companyHQId: string | null = null;
    if (to) {
      const companySlug = extractCompanySlugFromAddress(to);
      if (companySlug) {
        const company = await prisma.company_hqs.findUnique({
          where: { slug: companySlug },
          select: { id: true },
        });
        if (company) {
          companyHQId = company.id;
        }
      }
    }

    // STEP 4: Create InboundEmail record (raw ingestion bucket)
    // Store SendGrid fields exactly as received (matching SendGrid field names, case-sensitive)
    const inboundEmail = await prisma.inboundEmail.create({
      data: {
        // Core fields
        from: from,
        to: to,
        subject: subject,
        text: text,
        html: html,
        headers: headers,
        // Additional SendGrid fields
        sender_ip: sender_ip,
        envelope: envelope,
        dkim: dkim,
        SPF: SPF,
        spam_score: spam_score,
        spam_report: spam_report,
        charsets: charsets,
        attachments: attachments,
        attachment_info: attachment_info,
        raw: raw, // Only if "Include Raw" enabled in SendGrid
        // Our fields
        companyHQId: companyHQId,
        ingestionStatus: 'RECEIVED',
      },
    });

    // Log if content is missing
    if (!text && !html && !raw) {
      console.warn('⚠️ No email content detected (text/html/raw all empty).');
      console.warn('💡 Check SendGrid Inbound Parse settings - enable "Include Raw" if needed.');
    }

    // STEP 4: Minimal logging
    console.log('InboundEmail stored:', inboundEmail.id);

    // STEP 5: Return 200 immediately
    return NextResponse.json({
      success: true,
      inboundEmailId: inboundEmail.id,
    }, { status: 200 });

  } catch (err) {
    console.error('InboundEmail ingestion error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
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
