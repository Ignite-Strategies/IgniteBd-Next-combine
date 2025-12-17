import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/proposals/create/from-csv
 * Creates a proposal directly from CSV data (bypasses templates)
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
      deliverables, // Array of deliverable objects from CSV
    } = body ?? {};

    // Validate required fields
    if (!companyHQId || !contactId || !companyId || !title) {
      return NextResponse.json(
        { success: false, error: 'companyHQId, contactId, companyId, and title are required' },
        { status: 400 },
      );
    }

    if (!deliverables || !Array.isArray(deliverables) || deliverables.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one deliverable is required' },
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

    // Create proposal with deliverables
    // Set estimatedStart to 30 days from now as default
    const estimatedStart = new Date();
    estimatedStart.setDate(estimatedStart.getDate() + 30);

    const proposal = await prisma.proposal.create({
      data: {
        companyHQId,
        title,
        contactId,
        companyId,
        estimatedStart,
        purpose: description || null,
        status: 'draft',
        totalPrice: null, // Can be calculated later
        dateIssued: new Date(),
        proposalDeliverables: {
          create: deliverables.map((deliverable) => ({
            name: deliverable.name || 'Unnamed Deliverable',
            description: deliverable.description || null,
            quantity: deliverable.quantity || 1,
            unitPrice: null, // Can be set later
            totalPrice: null, // Can be calculated later
            notes: deliverable.notes || null, // Contains phaseName, unit, durationUnit, durationUnits as JSON
          })),
        },
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

    console.log('✅ Proposal created from CSV:', proposal.id);

    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error('❌ CreateProposalFromCSV error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create proposal from CSV' },
      { status: 500 },
    );
  }
}

