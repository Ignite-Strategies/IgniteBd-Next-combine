import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/proposals/[proposalId]/deliverables
 * Adds deliverables to an existing proposal
 */
export async function POST(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Handle Next.js 15+ async params (params is a Promise in Next.js 15+)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { proposalId } = resolvedParams;
    const body = await request.json();
    const { deliverables } = body ?? {};

    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'proposalId is required' },
        { status: 400 },
      );
    }

    if (!deliverables || !Array.isArray(deliverables) || deliverables.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one deliverable is required' },
        { status: 400 },
      );
    }

    // Verify proposal exists
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      return NextResponse.json(
        { success: false, error: 'Proposal not found' },
        { status: 404 },
      );
    }

    // Create deliverables
    const createdDeliverables = await prisma.proposalDeliverable.createMany({
      data: deliverables.map((deliverable) => ({
        proposalId,
        name: deliverable.name || 'Untitled Deliverable',
        description: deliverable.description || null,
        quantity: deliverable.quantity || 1,
        unitPrice: null, // Can be set later
        totalPrice: null, // Can be calculated later
        notes: deliverable.notes || null, // Contains phaseName, unit, durationUnit, durationUnits as JSON
      })),
    });

    // Fetch updated proposal with deliverables
    const updatedProposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        proposalDeliverables: true,
      },
    });

    console.log('✅ Deliverables added to proposal:', proposalId, `(${createdDeliverables.count} items)`);

    return NextResponse.json({
      success: true,
      proposal: updatedProposal,
      deliverablesAdded: createdDeliverables.count,
    });
  } catch (error) {
    console.error('❌ AddDeliverablesToProposal error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add deliverables to proposal' },
      { status: 500 },
    );
  }
}

