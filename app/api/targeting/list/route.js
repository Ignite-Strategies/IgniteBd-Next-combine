import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/**
 * GET /api/targeting/list
 * Returns contacts in the prospect / need-to-engage pipeline stage for the given company.
 * These are contacts submitted via the Target Cockpit awaiting first outreach.
 *
 * Query params:
 * - companyHQId (required)
 */
export async function GET(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');

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

    const targets = await prisma.contact.findMany({
      where: {
        crmId: companyHQId,
        pipelines: {
          pipeline: 'prospect',
          stage: 'need-to-engage',
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        companyName: true,
        title: true,
        linkedinUrl: true,
        howMet: true,
        notes: true,
        outreachPersonaSlug: true,
        prior_relationship: true,
        pipelineSnap: true,
        pipelineStageSnap: true,
        enrichmentFetchedAt: true,
        createdAt: true,
        updatedAt: true,
        pipelines: {
          select: { pipeline: true, stage: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ success: true, targets, count: targets.length });
  } catch (error) {
    console.error('❌ TargetingList error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch targets', details: error.message },
      { status: 500 },
    );
  }
}
