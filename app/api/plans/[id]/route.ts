import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/plans/[id]
 * Get a single plan by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = await params;

    const plan = await prisma.plans.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            company_hqs: true, // Count companies using this plan
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      plan: {
        ...plan,
        companyCount: plan._count.company_hqs,
      },
    });
  } catch (error) {
    console.error('❌ Get plan error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get plan',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/plans/[id]
 * Update a plan
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, amountCents, currency, interval } = body;

    // Check if plan exists
    const existingPlan = await prisma.plans.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 },
      );
    }

    // Validation
    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json(
        { success: false, error: 'Plan name cannot be empty' },
        { status: 400 },
      );
    }

    if (amountCents !== undefined && amountCents <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400 },
      );
    }

    // Update plan
    const plan = await prisma.plans.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(amountCents !== undefined && { amountCents: Math.round(amountCents) }),
        ...(currency !== undefined && { currency: currency.toLowerCase() }),
        ...(interval !== undefined && { interval: interval || null }),
      },
    });

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('❌ Update plan error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update plan',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/plans/[id]
 * Delete a plan (only if no companies are using it)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = await params;

    // Check if plan exists and has companies
    const plan = await prisma.plans.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            company_hqs: true,
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 },
      );
    }

    if (plan._count.company_hqs > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete plan that is in use by companies' },
        { status: 400 },
      );
    }

    // Delete plan
    await prisma.plans.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete plan error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete plan',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

