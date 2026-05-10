import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { universalEmailParser } from '@/lib/services/universalEmailParser';
import { autoProcessInboundEmail } from '@/lib/services/inboundAutoProcessService';

/**
 * POST /api/inbound-parse/process-pending
 *
 * Bulk-process pending inbound OUTREACH rows (ingestionStatus RECEIVED).
 * Auth: Firebase (same as push-to-ai).
 *
 * Body (optional): { limit?: number, senderEmail?: string }
 * - senderEmail: only rows whose From resolves to this address (case-insensitive)
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const limitRaw = body.limit;
  const limit =
    typeof limitRaw === 'number' && Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), 100)
      : 50;

  const senderFilter =
    typeof body.senderEmail === 'string' && body.senderEmail.trim()
      ? body.senderEmail.trim().toLowerCase()
      : null;

  const fetchCap = senderFilter ? Math.min(limit * 5, 500) : limit;

  const rows = await prisma.inboundEmail.findMany({
    where: {
      ingestionStatus: 'RECEIVED',
      OR: [{ inboundType: 'OUTREACH' }, { inboundType: null }],
    },
    orderBy: { createdAt: 'asc' },
    take: fetchCap,
    select: { id: true, from: true },
  });

  const idsToProcess: string[] = [];
  for (const row of rows) {
    if (idsToProcess.length >= limit) break;
    if (!senderFilter) {
      idsToProcess.push(row.id);
      continue;
    }
    try {
      const parsed = universalEmailParser({
        from: row.from || '',
        to: '',
        subject: '',
        text: '',
        html: '',
      });
      const fromLower = (parsed.fromEmail || '').toLowerCase();
      if (fromLower === senderFilter) {
        idsToProcess.push(row.id);
      }
    } catch {
      // skip rows we can't parse for sender filter
    }
  }

  const results: {
    id: string;
    ok: boolean;
    error?: string;
    recordId?: string;
    recordType?: string;
    contactId?: string | null;
  }[] = [];

  let processed = 0;
  let failed = 0;

  for (const id of idsToProcess) {
    const result = await autoProcessInboundEmail(prisma, {
      inboundEmailId: id,
      requireReceivedStatus: true,
      markAutoProcessed: true,
    });
    if (result.success === false) {
      failed += 1;
      results.push({ id, ok: false, error: result.error });
    } else {
      processed += 1;
      results.push({
        id,
        ok: true,
        recordId: result.recordId,
        recordType: result.recordType,
        contactId: result.contactId,
      });
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      processed,
      failed,
      attempted: idsToProcess.length,
      fetched: rows.length,
      ...(senderFilter ? { senderEmailFilter: senderFilter } : {}),
    },
    results,
  });
}
