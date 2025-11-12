import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { convertProposalToDeliverables } from '@/lib/services/ProposalToDeliverablesService';

export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { proposalId } = params || {};
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'proposalId is required' },
        { status: 400 },
      );
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        companyHQ: true,
        company: true,
      },
    });

    if (!proposal) {
      return NextResponse.json(
        { success: false, error: 'Proposal not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error('❌ GetProposal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get proposal',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { proposalId } = params || {};
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'proposalId is required' },
        { status: 400 },
      );
    }

    const existingProposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!existingProposal) {
      return NextResponse.json(
        { success: false, error: 'Proposal not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const {
      clientName,
      clientCompany,
      companyId,
      purpose,
      status,
      serviceInstances,
      phases,
      milestones,
      compensation,
      totalPrice,
      preparedBy,
    } = body ?? {};

    const updateData = {};
    if (clientName !== undefined) updateData.clientName = clientName;
    if (clientCompany !== undefined) updateData.clientCompany = clientCompany;
    if (companyId !== undefined) updateData.companyId = companyId || null;
    if (purpose !== undefined) updateData.purpose = purpose || null;
    if (status !== undefined) {
      updateData.status = status;
      
      // If status is changing to "approved", trigger deliverables conversion
      if (status === 'approved' && existingProposal.status !== 'approved') {
        try {
          const conversionResult = await convertProposalToDeliverables(proposalId);
          console.log('✅ Proposal approved, deliverables created:', conversionResult);
        } catch (conversionError) {
          console.error('⚠️ Failed to convert proposal to deliverables:', conversionError);
          // Don't fail the proposal update if conversion fails
          // Deliverables can be created manually later
        }
      }
    }
    if (serviceInstances !== undefined) {
      updateData.serviceInstances = serviceInstances ? JSON.parse(JSON.stringify(serviceInstances)) : null;
    }
    if (phases !== undefined) {
      updateData.phases = phases ? JSON.parse(JSON.stringify(phases)) : null;
    }
    if (milestones !== undefined) {
      updateData.milestones = milestones ? JSON.parse(JSON.stringify(milestones)) : null;
    }
    if (compensation !== undefined) {
      updateData.compensation = compensation ? JSON.parse(JSON.stringify(compensation)) : null;
    }
    if (preparedBy !== undefined) {
      updateData.preparedBy = preparedBy || null;
    }

    if (compensation !== undefined && compensation?.total) {
      updateData.totalPrice = compensation.total;
    } else if (serviceInstances !== undefined && Array.isArray(serviceInstances)) {
      updateData.totalPrice = serviceInstances.reduce(
        (sum, service) => sum + (service.price || 0),
        0,
      );
    } else if (totalPrice !== undefined) {
      updateData.totalPrice = totalPrice;
    }

    const proposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: updateData,
      include: {
        companyHQ: true,
        company: true,
      },
    });

    if (companyId !== undefined && companyId) {
      await prisma.company.update({
        where: { id: companyId },
        data: { proposalId: proposal.id },
      });
    }

    console.log('✅ Proposal updated:', proposal.id);

    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error('❌ UpdateProposal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update proposal',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { proposalId } = params || {};
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'proposalId is required' },
        { status: 400 },
      );
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      return NextResponse.json(
        { success: false, error: 'Proposal not found' },
        { status: 404 },
      );
    }

    if (proposal.companyId) {
      await prisma.company.update({
        where: { id: proposal.companyId },
        data: { proposalId: null },
      });
    }

    await prisma.proposal.delete({
      where: { id: proposalId },
    });

    console.log('✅ Proposal deleted:', proposalId);

    return NextResponse.json({
      success: true,
      message: 'Proposal deleted',
    });
  } catch (error) {
    console.error('❌ DeleteProposal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete proposal',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

