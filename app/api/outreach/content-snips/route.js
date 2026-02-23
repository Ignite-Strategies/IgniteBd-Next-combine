import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

const SNIP_TYPES = ['subject', 'intent', 'service', 'competitor', 'value', 'cta', 'relationship', 'generic'];
const CONTEXT_TYPES = ['email', 'blog', 'linkedin', 'internal', 'multi'];
const INTENT_TYPES = ['reactivation', 'prior_contact', 'intro', 'competitor', 'seasonal', 'relationship_only'];

function normalizeSnipName(s) {
  return String(s).trim().replace(/\s+/g, '_').toLowerCase() || null;
}

/**
 * GET /api/outreach/content-snips?companyHQId=xxx&snipType=xxx&contextType=xxx&intentType=xxx&activeOnly=true
 */
export async function GET(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const companyHQId = request.nextUrl?.searchParams?.get('companyHQId');
  if (!companyHQId) {
    return NextResponse.json({ success: false, error: 'companyHQId is required' }, { status: 400 });
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const snipType = request.nextUrl?.searchParams?.get('snipType');
  const contextType = request.nextUrl?.searchParams?.get('contextType');
  const intentType = request.nextUrl?.searchParams?.get('intentType');
  const activeOnly = request.nextUrl?.searchParams?.get('activeOnly') !== 'false';

  const where = { companyHQId };
  if (activeOnly) where.isActive = true;
  if (snipType) where.snipType = snipType;
  if (contextType) where.contextType = contextType;
  if (intentType) where.intentType = intentType;

  const snips = await prisma.content_snips.findMany({
    where,
    orderBy: [{ snipType: 'asc' }, { snipName: 'asc' }],
  });

  return NextResponse.json({ success: true, snips });
}

/**
 * POST /api/outreach/content-snips
 * Body: { companyHQId, snipName, snipText, snipType, contextType?, intentType?, isActive? }
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { companyHQId, snipName, snipText, snipType, contextType, intentType, isActive } = body;

  if (!companyHQId || !snipName || snipText === undefined || !snipType) {
    return NextResponse.json(
      { success: false, error: 'companyHQId, snipName, snipText, and snipType are required' },
      { status: 400 },
    );
  }

  const owner = await prisma.owners.findUnique({
    where: { firebaseId: firebaseUser.uid },
    select: { id: true },
  });
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Owner not found' }, { status: 404 });
  }

  const { membership } = await resolveMembership(owner.id, companyHQId);
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const name = normalizeSnipName(snipName);
  if (!name) {
    return NextResponse.json({ success: false, error: 'snipName cannot be empty' }, { status: 400 });
  }
  if (!SNIP_TYPES.includes(snipType)) {
    return NextResponse.json(
      { success: false, error: `snipType must be one of: ${SNIP_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const snip = await prisma.content_snips.upsert({
    where: {
      companyHQId_snipName: { companyHQId, snipName: name },
    },
    update: {
      snipText: String(snipText).trim(),
      snipType,
      contextType: contextType && CONTEXT_TYPES.includes(contextType) ? contextType : null,
      intentType: intentType && INTENT_TYPES.includes(intentType) ? intentType : null,
      isActive: isActive !== false,
      updatedAt: new Date(),
    },
    create: {
      companyHQId,
      snipName: name,
      snipText: String(snipText).trim(),
      snipType,
      contextType: contextType && CONTEXT_TYPES.includes(contextType) ? contextType : null,
      intentType: intentType && INTENT_TYPES.includes(intentType) ? intentType : null,
      isActive: isActive !== false,
    },
  });

  return NextResponse.json({ success: true, snip });
}
