import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/proposals/create/blank
 * Creates a blank proposal without deliverables (deliverables added separately)
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
      companyHQId,
      contactId,
      companyId,
      title,
      description,
    } = body ?? {};

    // Validate required fields
    if (!companyHQId || !contactId || !companyId || !title) {
      return NextResponse.json(
        { success: false, error: 'companyHQId, contactId, companyId, and title are required' },
        { status: 400 },
      );
    }

    // Verify contact and company exist
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    // Set estimatedStart to 30 days from now as default
    const estimatedStart = new Date();
    estimatedStart.setDate(estimatedStart.getDate() + 30);

    // Create proposal without deliverables
    const proposal = await prisma.proposal.create({
      data: {
        companyHQId,
        title,
        contactId,
        companyId,
        estimatedStart,
        purpose: description || null,
        status: 'draft',
        totalPrice: null, // Can be calculated later when deliverables are added
        dateIssued: new Date(),
        // No proposalPhases or proposalDeliverables - user adds them later
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
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        proposalDeliverables: true,
      },
    });

    console.log('✅ Blank proposal created:', proposal.id);

    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error('❌ CreateBlankProposal error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create blank proposal' },
      { status: 500 },
    );
  }
}

