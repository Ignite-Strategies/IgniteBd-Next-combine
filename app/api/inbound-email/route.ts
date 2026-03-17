import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseInboundRecipient, extractCompanySlugFromAddress } from '@/lib/utils/parseEmailAddress';
import { simpleParser } from 'mailparser';

/**
 * POST /api/inbound-email
 *
 * SendGrid Inbound Parse webhook endpoint - MVP1 Ingestion
 *
 * Architecture:
 * SendGrid → InboundEmail (raw ingestion + MIME parse) → Future async processor → EmailActivity
 *
 * This endpoint is public and does not require authentication (webhook-safe).
 *
 * - Stores all raw SendGrid fields as-is
 * - If 'email' MIME field is present, parses it with mailparser to extract
 *   readable text/html (handles forwarded Outlook emails that skip parsed fields)
 */
export async function POST(req: Request) {
  try {
    // STEP 1: Extract formData (multipart/form-data from SendGrid)
    const formData = await req.formData();

    // STEP 2: Extract SendGrid fields (exact match, case-sensitive)
    const from            = (formData.get('from')            as string | null) || null;
    const to              = (formData.get('to')              as string | null) || null;
    const subject         = (formData.get('subject')         as string | null) || null;
    let   text            = (formData.get('text')            as string | null) || null;
    let   html            = (formData.get('html')            as string | null) || null;
    const headers         = (formData.get('headers')         as string | null) || null;
    const sender_ip       = (formData.get('sender_ip')       as string | null) || null;
    const envelope        = (formData.get('envelope')        as string | null) || null;
    const dkim            = (formData.get('dkim')            as string | null) || null;
    const SPF             = (formData.get('SPF')             as string | null) || null; // case-sensitive
    const spam_score      = (formData.get('spam_score')      as string | null) || null;
    const spam_report     = (formData.get('spam_report')     as string | null) || null;
    const charsets        = (formData.get('charsets')        as string | null) || null;
    const attachments     = (formData.get('attachments')     as string | null) || null;
    const attachment_info = (formData.get('attachment-info') as string | null) || null;
    const email           = (formData.get('email')           as string | null) || null; // raw MIME

    // STEP 3: Parse MIME if text/html are missing (forwarded emails from Outlook etc.)
    // The 'email' field contains the full RFC 2822 MIME message with base64-encoded body parts.
    if (email && !text && !html) {
      try {
        const parsed = await simpleParser(email);
        text = parsed.text || null;
        html = parsed.html || null;
        console.log('MIME parsed:', {
          hasText: !!text,
          textLength: text?.length || 0,
          hasHtml: !!html,
          htmlLength: html?.length || 0,
        });
      } catch (parseErr) {
        console.warn('MIME parse failed (non-fatal):', parseErr);
      }
    }

    // STEP 4: Parse recipient to get company slug and type (meeting vs email)
    const recipient = to ? parseInboundRecipient(to) : null;
    let companyHQId: string | null = null;
    const slug = recipient?.companySlug ?? (to ? extractCompanySlugFromAddress(to) : null);
    if (slug) {
      const company = await prisma.company_hqs.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (company) {
        companyHQId = company.id;
      }
    }

    if (!companyHQId) {
      console.log('Inbound: no company for slug, returning 200');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const inboundType = recipient?.inboundType === 'meeting' ? 'MEETING' : 'OUTREACH';

    const inboundEmail = await prisma.inboundEmail.create({
      data: {
        from,
        to,
        subject,
        text: text ?? null,
        html: html ?? null,
        headers,
        sender_ip,
        envelope,
        dkim,
        SPF,
        spam_score,
        spam_report,
        charsets,
        attachments,
        attachment_info,
        email: email ?? null,
        companyHQId,
        inboundType,
        ingestionStatus: 'RECEIVED',
      },
    });

    console.log('InboundEmail stored:', inboundEmail.id, { inboundType, hasText: !!text, hasHtml: !!html, hasRawMime: !!email });

    return NextResponse.json(
      { success: true, inboundEmailId: inboundEmail.id, inboundType },
      { status: 200 }
    );

  } catch (err) {
    console.error('InboundEmail ingestion error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. This endpoint only accepts POST requests.' },
    { status: 405 }
  );
}
