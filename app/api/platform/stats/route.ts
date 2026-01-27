import { NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebaseAdmin'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/platform/stats
 * 
 * Get platform-wide statistics.
 * Returns counts and estimated MRR.
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
    const [totalCompanies, totalOwners, totalMemberships, companiesWithPlans] = await Promise.all([
      prisma.company_hqs.count(),
      prisma.owners.count(),
      prisma.company_memberships.count(),
      prisma.company_hqs.findMany({
        where: { planId: { not: null } },
        select: {
          plans: {
            select: { amountCents: true, interval: true },
          },
        },
      }),
    ])

    let estimatedMRRCents = 0
    for (const row of companiesWithPlans) {
      const p = row.plans
      if (!p) continue
      if (p.interval === 'MONTH') estimatedMRRCents += p.amountCents
      else if (p.interval === 'YEAR') estimatedMRRCents += Math.round(p.amountCents / 12)
    }

    return NextResponse.json({
      success: true,
      totalCompanies,
      totalOwners,
      totalMemberships,
      estimatedMRRCents,
    })
  } catch (error) {
    console.error('❌ Platform stats error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
