import { NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebaseAdmin'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/platform/company-hqs
 * 
 * List all company_hqs (tenant companies) for Platform Manager.
 * Supports search query parameter.
 * 
 * Query params:
 * - query (optional): Search by companyName
 * 
 * Returns:
 * - companies: Array of company_hqs with plan info
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')

    const where: any = {}
    if (query) {
      where.companyName = {
        contains: query,
        mode: 'insensitive',
      }
    }

    const companies = await prisma.company_hqs.findMany({
      where,
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
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Flatten owner and plan data
    const formattedCompanies = companies.map((company) => ({
      ...company,
      owner: company.owners_company_hqs_ownerIdToowners,
      owners_company_hqs_ownerIdToowners: undefined,
      planName: company.plans?.name || 'No Plan',
    }))

    return NextResponse.json({
      success: true,
      companies: formattedCompanies,
    })
  } catch (error) {
    console.error('❌ List company_hqs error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list company_hqs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
