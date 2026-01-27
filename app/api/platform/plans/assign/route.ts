import { NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebaseAdmin'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/platform/plans/assign
 * 
 * Assign a plan to a company_hq (set company_hqs.planId).
 * Returns the updated company with FK relations.
 * 
 * Body: { companyId, planId }
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { companyId, planId } = body ?? {}

    if (!companyId || !planId) {
      return NextResponse.json(
        { success: false, error: 'companyId and planId are required' },
        { status: 400 }
      )
    }

    const plan = await prisma.plans.findUnique({
      where: { id: planId },
      select: { id: true, name: true },
    })
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      )
    }

    const company = await prisma.company_hqs.update({
      where: { id: companyId },
      data: { planId },
      select: {
        id: true,
        companyName: true,
        planId: true,
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
      },
    })

    // Flatten owner and plan data
    const formattedCompany = {
      id: company.id,
      companyName: company.companyName,
      planId: company.planId,
      planName: company.plans?.name,
      plans: company.plans,
      owner: company.owners_company_hqs_ownerIdToowners,
    }

    return NextResponse.json({
      success: true,
      message: `Company "${company.companyName}" assigned to plan "${company.plans?.name ?? planId}".`,
      company: formattedCompany,
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }
    console.error('❌ Plan assign error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to assign plan to company',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
