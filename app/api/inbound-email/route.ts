import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
 */
export async function POST(req: Request) {
  try {
    // STEP 1: Extract formData (multipart/form-data from SendGrid)
    const formData = await req.formData();

    // STEP 2: Safe extraction of fields
    const from = typeof formData.get('from') === 'string'
      ? formData.get('from') as string
      : '';

    const to = typeof formData.get('to') === 'string'
      ? formData.get('to') as string
      : '';

    const subject = typeof formData.get('subject') === 'string'
      ? formData.get('subject') as string
      : '';

    const text = typeof formData.get('text') === 'string'
      ? formData.get('text') as string
      : '';

    const html = typeof formData.get('html') === 'string'
      ? formData.get('html') as string
      : '';

    const headers = typeof formData.get('headers') === 'string'
      ? formData.get('headers') as string
      : '';

    // STEP 3: Create InboundEmail record (raw ingestion bucket)
    const inboundEmail = await prisma.inboundEmail.create({
      data: {
        from: from || null,
        to: to || null,
        subject: subject || null,
        textBody: text || null,
        htmlBody: html || null,
        headers: headers || null,
        ingestionStatus: 'RECEIVED',
      },
    });

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
