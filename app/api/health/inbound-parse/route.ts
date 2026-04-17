import { NextResponse } from 'next/server';
import { promises as dns } from 'dns';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

const INBOUND_PARSE_HOST = 'crm.ignitestrategies.co';
const EXPECTED_MX = 'mx.sendgrid.net';
const STALE_DAYS = 1;

/**
 * GET /api/health/inbound-parse
 *
 * Checks inbound parse pipeline health:
 * - MX record for crm.ignitestrategies.co → mx.sendgrid.net
 * - Most recent InboundEmail received (global, across all tenants)
 *
 * Returns:
 *   mxOk: boolean
 *   mxRecords: string[]
 *   lastReceivedAt: ISO string | null
 *   daysSinceLastReceived: number | null
 *   status: 'ok' | 'stale' | 'down'
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // MX check
  let mxOk = false;
  let mxRecords: string[] = [];
  try {
    const records = await dns.resolveMx(INBOUND_PARSE_HOST);
    mxRecords = records.map((r) => r.exchange.toLowerCase().replace(/\.$/, ''));
    mxOk = mxRecords.some((r) => r.includes('sendgrid'));
  } catch {
    mxOk = false;
    mxRecords = [];
  }

  // Last received
  let lastReceivedAt: string | null = null;
  let daysSinceLastReceived: number | null = null;
  try {
    const latest = await prisma.inboundEmail.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (latest) {
      lastReceivedAt = latest.createdAt.toISOString();
      const msAgo = Date.now() - latest.createdAt.getTime();
      daysSinceLastReceived = Math.floor(msAgo / (1000 * 60 * 60 * 24));
    }
  } catch {
    // Non-fatal — MX status is the primary signal
  }

  const isStale =
    daysSinceLastReceived !== null && daysSinceLastReceived >= STALE_DAYS;

  const status: 'ok' | 'stale' | 'down' = !mxOk
    ? 'down'
    : isStale || lastReceivedAt === null
      ? 'stale'
      : 'ok';

  console.log('Inbound parse health check:', { mxOk, mxRecords, lastReceivedAt, daysSinceLastReceived, status });

  return NextResponse.json({
    success: true,
    mxOk,
    mxRecords,
    host: INBOUND_PARSE_HOST,
    expectedMx: EXPECTED_MX,
    lastReceivedAt,
    daysSinceLastReceived,
    status,
  });
}
