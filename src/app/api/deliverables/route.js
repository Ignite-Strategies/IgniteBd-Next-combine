import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken, optionallyVerifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/deliverables
 * List deliverables, optionally filtered by contactId or proposalId
 * 
 * Query params:
 * - contactId: Filter by contact ID
 * - proposalId: Filter by proposal ID
 * - status: Filter by status (pending, in-progress, completed, blocked)
 */
export async function GET(request) {
  // Optional auth for read operations
  await optionallyVerifyFirebaseToken(request);

  try {
    const { searchParams } = request.nextUrl;
    const contactId = searchParams.get('contactId');
    const proposalId = searchParams.get('proposalId');
    const status = searchParams.get('status');

    const where = {};
    if (contactId) where.contactId = contactId;
    if (proposalId) where.proposalId = proposalId;
    if (status) where.status = status;

    const deliverables = await prisma.consultantDeliverable.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            contactCompany: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
        proposal: {
          select: {
            id: true,
            clientName: true,
            clientCompany: true,
            status: true,
          },
        },
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      deliverables,
      count: deliverables.length,
    });
  } catch (error) {
    console.error('❌ ListDeliverables error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list deliverables',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/deliverables
 * Create a new deliverable
 * 
 * Body:
 * - contactId (required)
 * - title (required)
 * - description (optional)
 * - category (optional)
 * - proposalId (optional)
 * - milestoneId (optional)
 * - dueDate (optional)
 * - status (optional, defaults to "pending")
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      contactId,
      title,
      description,
      category,
      proposalId,
      milestoneId,
      dueDate,
      status = 'pending',
    } = body ?? {};

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 },
      );
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Verify proposal exists if provided
    if (proposalId) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
      });

      if (!proposal) {
        return NextResponse.json(
          { success: false, error: 'Proposal not found' },
          { status: 404 },
        );
      }
    }

    const deliverable = await prisma.consultantDeliverable.create({
      data: {
        contactId,
        title,
        description: description || null,
        category: category || null,
        proposalId: proposalId || null,
        milestoneId: milestoneId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status,
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        proposal: {
          select: {
            id: true,
            clientName: true,
            clientCompany: true,
          },
        },
      },
    });

    console.log('✅ Deliverable created:', deliverable.id);

    return NextResponse.json({
      success: true,
      deliverable,
    });
  } catch (error) {
    console.error('❌ CreateDeliverable error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create deliverable',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

