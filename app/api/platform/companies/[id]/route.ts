import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/platform/companies/[id]
 * Get company details including payment status
 * Used by platform-manager to display payment dashboard
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id: companyId } = params;

    const company = await prisma.company_hqs.findUnique({
      where: { id: companyId },
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            description: true,
            amountCents: true,
            currency: true,
            interval: true,
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        companyName: company.companyName,
        planId: company.planId,
        planStatus: company.planStatus,
        stripeSubscriptionId: company.stripeSubscriptionId,
        planStartedAt: company.planStartedAt,
        planEndedAt: company.planEndedAt,
        plans: company.plans,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching company:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company' },
      { status: 500 },
    );
  }
}

