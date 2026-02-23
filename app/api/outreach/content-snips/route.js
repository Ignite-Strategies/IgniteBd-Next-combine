import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

const TEMPLATE_POSITIONS = ['SUBJECT_LINE', 'OPENING_GREETING', 'CATCH_UP', 'BUSINESS_CONTEXT', 'VALUE_PROPOSITION', 'COMPETITOR_FRAME', 'TARGET_ASK', 'SOFT_CLOSE'];

function normalizeSnipName(s) {
  return String(s).trim().replace(/\s+/g, '_').toLowerCase() || null;
}

/**
 * GET /api/outreach/content-snips?companyHQId=xxx&templatePosition=xxx
 * companyHQId required for auth only (membership check); snippets are global.
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

  const templatePosition = request.nextUrl?.searchParams?.get('templatePosition');
  const where = {};
  if (templatePosition && TEMPLATE_POSITIONS.includes(templatePosition)) where.templatePosition = templatePosition;

  try {
    const snips = await prisma.contentSnip.findMany({
      where,
      orderBy: [{ templatePosition: 'asc' }, { snipName: 'asc' }],
    });
    return NextResponse.json({ success: true, snips });
  } catch (error) {
    console.error('❌ GET /api/outreach/content-snips error:', error?.message || error, error?.stack);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load content snippets',
        detail: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/outreach/content-snips
 * Body: { companyHQId, snipName, snipSlug?, snipText, templatePosition, personaSlug?, bestUsedWhen? }
 * companyHQId required for auth. snipSlug optional (derived from snipName if omitted).
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { companyHQId, snipName, snipSlug, snipText, templatePosition, personaSlug, bestUsedWhen } = body;

  if (!companyHQId || !snipName || snipText === undefined || !templatePosition) {
    return NextResponse.json(
      { success: false, error: 'companyHQId, snipName, snipText, and templatePosition are required' },
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
  if (!TEMPLATE_POSITIONS.includes(templatePosition)) {
    return NextResponse.json(
      { success: false, error: `templatePosition must be one of: ${TEMPLATE_POSITIONS.join(', ')}` },
      { status: 400 },
    );
  }

  const slug = (snipSlug && String(snipSlug).trim()) ? String(snipSlug).trim().toLowerCase().replace(/\s+/g, '_') : name;

  const snip = await prisma.contentSnip.upsert({
    where: { snipSlug: slug },
    update: {
      snipName: name,
      snipText: String(snipText).trim(),
      templatePosition,
      personaSlug: personaSlug != null ? String(personaSlug).trim() || null : undefined,
      bestUsedWhen: bestUsedWhen != null ? String(bestUsedWhen).trim() || null : undefined,
      updatedAt: new Date(),
    },
    create: {
      snipName: name,
      snipSlug: slug,
      snipText: String(snipText).trim(),
      templatePosition,
      personaSlug: personaSlug != null ? String(personaSlug).trim() || null : null,
      bestUsedWhen: bestUsedWhen != null ? String(bestUsedWhen).trim() || null : null,
    },
  });

  return NextResponse.json({ success: true, snip });
}
