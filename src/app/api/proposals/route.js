import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

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
      clientName,
      clientCompany,
      companyId,
      purpose,
      status = 'draft',
      serviceInstances,
      phases,
      milestones,
      compensation,
      totalPrice,
      preparedBy,
    } = body ?? {};

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQId is required' },
        { status: 400 },
      );
    }

    if (!clientName || !clientCompany) {
      return NextResponse.json(
        { success: false, error: 'Client name and company are required' },
        { status: 400 },
      );
    }

    const companyHQ = await prisma.companyHQ.findUnique({
      where: { id: companyHQId },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    let calculatedPrice = totalPrice;
    if (!calculatedPrice && compensation?.total) {
      calculatedPrice = compensation.total;
    } else if (!calculatedPrice && Array.isArray(serviceInstances)) {
      calculatedPrice = serviceInstances.reduce(
        (sum, service) => sum + (service.price || 0),
        0,
      );
    }

    const proposal = await prisma.proposal.create({
      data: {
        companyHQId,
        clientName,
        clientCompany,
        companyId: companyId || null,
        purpose: purpose || null,
        status,
        serviceInstances: serviceInstances ? JSON.parse(JSON.stringify(serviceInstances)) : null,
        phases: phases ? JSON.parse(JSON.stringify(phases)) : null,
        milestones: milestones ? JSON.parse(JSON.stringify(milestones)) : null,
        compensation: compensation ? JSON.parse(JSON.stringify(compensation)) : null,
        totalPrice: calculatedPrice || null,
        preparedBy: preparedBy || null,
        dateIssued: new Date(),
      },
      include: {
        companyHQ: true,
        company: true,
      },
    });

    if (companyId) {
      await prisma.company.update({
        where: { id: companyId },
        data: { proposalId: proposal.id },
      });
    }

    console.log('✅ Proposal created:', proposal.id);

    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error('❌ CreateProposal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create proposal',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');
    const status = searchParams.get('status');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQId is required' },
        { status: 400 },
      );
    }

    const where = {
      companyHQId,
    };

    if (status) {
      where.status = status;
    }

    const proposals = await prisma.proposal.findMany({
      where,
      include: {
        companyHQ: true,
        company: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      proposals,
    });
  } catch (error) {
    console.error('❌ ListProposals error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list proposals',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

