import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

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
  // Optional auth for read operations (but we need it to get companyHQId)
  let decodedToken;
  try {
    decodedToken = await verifyFirebaseToken(request);
  } catch (error) {
    // If no auth, we can't filter by companyHQId, so return empty
    return NextResponse.json({
      success: true,
      deliverables: [],
      count: 0,
    });
  }

  try {
    const { searchParams } = request.nextUrl;
    const contactId = searchParams.get('contactId');
    const proposalId = searchParams.get('proposalId');
    const status = searchParams.get('status');

    // Get companyHQId from authenticated user's contact
    // For now, we'll get it from the contact if contactId is provided
    // Or we can get it from the user's context if needed
    let companyHQId = null;
    if (contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { crmId: true },
      });
      if (contact) {
        companyHQId = contact.crmId;
      }
    }

    const where = {};
    if (contactId) where.contactId = contactId;
    if (proposalId) where.proposalId = proposalId;
    if (status) where.status = status;
    if (companyHQId) where.companyHQId = companyHQId; // Filter by tenant

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
      type, // "persona", "blog", "upload", etc.
      workContent, // JSON object with work artifact
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

    // Verify contact exists and get companyHQId and contactCompanyId
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        contactCompany: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Get companyHQId from contact (crmId)
    const companyHQId = contact.crmId;
    const contactCompanyId = contact.contactCompanyId;

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
        type: type || null, // "persona", "blog", "upload", etc.
        workContent: workContent || null, // JSON object with work artifact
        companyHQId, // Always linked to owner's company
        contactCompanyId: contactCompanyId || null, // Link to contact's company
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

