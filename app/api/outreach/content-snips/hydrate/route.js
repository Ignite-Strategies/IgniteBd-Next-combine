import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/**
 * GET /api/outreach/content-snips/hydrate?companyHQId=xxx
 * Returns all active snippets for a company as a hydrated key-value map
 * Optimized for template resolution: { snipName: snipText, ... }
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

  try {
    const snips = await prisma.content_snips.findMany({
      where: {
        companyHQId,
        isActive: true,
      },
      include: {
        relationship_contexts: true,
      },
      orderBy: [{ snipType: 'asc' }, { snipName: 'asc' }],
    });

    // Create hydrated map: snipName -> { snipText, snipType, relationshipContext, ... }
    const hydrated = {};
    snips.forEach((snip) => {
      hydrated[snip.snipName] = {
        snipText: snip.snipText,
        snipType: snip.snipType,
        relationshipContextId: snip.relationshipContextId,
        relationshipContext: snip.relationship_contexts
          ? {
              contextKey: snip.relationship_contexts.contextKey,
              contextOfRelationship: snip.relationship_contexts.contextOfRelationship,
              relationshipRecency: snip.relationship_contexts.relationshipRecency,
              companyAwareness: snip.relationship_contexts.companyAwareness,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      companyHQId,
      snippets: hydrated,
      count: snips.length,
      byType: snips.reduce((acc, snip) => {
        if (!acc[snip.snipType]) acc[snip.snipType] = [];
        acc[snip.snipType].push(snip.snipName);
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('❌ Snippet hydration error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to hydrate snippets' },
      { status: 500 },
    );
  }
}
