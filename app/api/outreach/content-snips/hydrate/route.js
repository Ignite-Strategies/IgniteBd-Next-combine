import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

const TEMPLATE_POSITIONS = ['SUBJECT_LINE', 'OPENING_GREETING', 'CATCH_UP', 'BUSINESS_CONTEXT', 'VALUE_PROPOSITION', 'COMPETITOR_FRAME', 'TARGET_ASK', 'SOFT_CLOSE'];

/**
 * GET /api/outreach/content-snips/hydrate?companyHQId=xxx&templatePosition=xxx
 * Returns snippets as a hydrated map keyed by snipSlug (for {{snippet:snipSlug}}).
 * Optional templatePosition: hydrate all, or only that position (e.g. SUBJECT_LINE).
 * companyHQId required for auth only.
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

  const templatePosition = request.nextUrl?.searchParams?.get('templatePosition');

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

  try {
    const where = templatePosition && TEMPLATE_POSITIONS.includes(templatePosition)
      ? { templatePosition }
      : {};
    const snips = await prisma.contentSnip.findMany({
      where,
      orderBy: [{ templatePosition: 'asc' }, { snipName: 'asc' }],
    });

    const hydrated = {};
    snips.forEach((snip) => {
      hydrated[snip.snipSlug] = {
        snipText: snip.snipText,
        templatePosition: snip.templatePosition,
        personaSlug: snip.personaSlug ?? null,
        bestUsedWhen: snip.bestUsedWhen ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      snippets: hydrated,
      count: snips.length,
      templatePositionFilter: templatePosition && TEMPLATE_POSITIONS.includes(templatePosition) ? templatePosition : null,
      byPosition: snips.reduce((acc, snip) => {
        if (!acc[snip.templatePosition]) acc[snip.templatePosition] = [];
        acc[snip.templatePosition].push(snip.snipSlug);
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('❌ Snippet hydration error:', error?.message || error, error?.stack);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to hydrate snippets',
        detail: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}
