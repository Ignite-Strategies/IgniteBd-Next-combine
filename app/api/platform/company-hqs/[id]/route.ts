import { NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebaseAdmin'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/platform/company-hqs/[id]
 * 
 * Get a single company_hq by ID with all FK relations.
 * 
 * Returns:
 * - company: company_hq with plan, owner, and member info
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyFirebaseToken(request)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { id } = await params

    const company = await prisma.company_hqs.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        createdAt: true,
        updatedAt: true,
        platformId: true,
        ownerId: true,
        planId: true,
        planStatus: true,
        stripeSubscriptionId: true,
        planStartedAt: true,
        planEndedAt: true,
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
        owners_company_hqs_ownerIdToowners: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            company_memberships: true,
          },
        },
      },
    })

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    // Get members
    const members = await prisma.company_memberships.findMany({
      where: { companyHqId: id },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        owners: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Flatten owner and plan data
    const formattedCompany = {
      ...company,
      owner: company.owners_company_hqs_ownerIdToowners,
      owners_company_hqs_ownerIdToowners: undefined,
      planName: company.plans?.name || 'No Plan',
    }

    const formattedMembers = members.map((member) => ({
      ...member,
      owner: member.owners,
      owners: undefined,
    }))

    return NextResponse.json({
      success: true,
      company: formattedCompany,
      members: formattedMembers,
    })
  } catch (error) {
    console.error('❌ Get company_hq error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch company_hq',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
