import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { takeCrmClientEmailAndParseAiService } from '@/lib/services/takeCrmClientEmailAndParseAiService';

/** Build input for AI parser */
function buildParseInput(inbound: {
  text: string | null;
  html: string | null;
  email: string | null;
}) {
  const text = inbound.text?.trim() || null;
  const html = inbound.html?.trim() || null;
  const raw = inbound.email?.trim() || null;
  if (!text && !html && !raw) {
    throw new Error('No content to parse (text, html, and email are all empty)');
  }
  return { text, html, raw };
}

/**
 * POST /api/inbound-parse/parse
 *
 * Parse an InboundEmail with AI and return parsed data for preview.
 * Does NOT create EmailActivity or update any records.
 * Use this to review what will be ingested before promoting.
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const inboundEmailId = body?.inboundEmailId;
    if (!inboundEmailId || typeof inboundEmailId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing inboundEmailId' },
        { status: 400 }
      );
    }

    const inbound = await prisma.inboundEmail.findUnique({
      where: { id: inboundEmailId },
    });

    if (!inbound) {
      return NextResponse.json(
        { success: false, error: 'InboundEmail not found' },
        { status: 404 }
      );
    }

    const parseInput = buildParseInput({
      text: inbound.text,
      html: inbound.html,
      email: inbound.email,
    });

    const parsed = await takeCrmClientEmailAndParseAiService(
      parseInput,
      inbound.headers ?? undefined
    );

    return NextResponse.json({
      success: true,
      parsed: {
        contactEmail: parsed.contactEmail,
        contactName: parsed.contactName,
        nextEngagementDate: parsed.nextEngagementDate,
        subject: parsed.subject,
        body: parsed.body,
        isResponse: parsed.isResponse,
      },
    });
  } catch (error) {
    console.error('❌ Parse only error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse email',
      },
      { status: 500 }
    );
  }
}
