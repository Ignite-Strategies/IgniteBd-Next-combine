import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { createStripeProductAndPrice } from '@/lib/stripe/plan';

/**
 * POST /api/plans
 * Create a new plan
 * Creates Stripe product and price immediately (not on checkout)
 */
export async function POST(request: Request) {
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
    const { name, description, amountCents, currency, interval } = body;

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Plan name is required' },
        { status: 400 },
      );
    }

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400 },
      );
    }

    // Create plan in database
    const plan = await prisma.plans.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        amountCents: Math.round(amountCents), // Ensure integer
        currency: currency?.toLowerCase() || 'usd',
        interval: interval || null, // null for one-time payments
      },
    });

    // Create Stripe product and price immediately (not on checkout)
    try {
      const { productId, priceId } = await createStripeProductAndPrice(plan.id);
      
      // Reload plan to get updated Stripe IDs
      const updatedPlan = await prisma.plans.findUnique({
        where: { id: plan.id },
      });

      return NextResponse.json({
        success: true,
        plan: updatedPlan,
        stripeProductId: productId,
        stripePriceId: priceId,
      });
    } catch (stripeError) {
      // If Stripe creation fails, still return the plan (Stripe IDs will be null)
      // They can be created later on first checkout
      console.error('⚠️ Failed to create Stripe product/price:', stripeError);
      return NextResponse.json({
        success: true,
        plan,
        warning: 'Plan created but Stripe product/price creation failed. Will be created on first checkout.',
      });
    }
  } catch (error) {
    console.error('❌ Create plan error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create plan',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/plans
 * List all plans
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const plans = await prisma.plans.findMany({
      include: {
        _count: {
          select: {
            company_hqs: true, // Count companies using this plan
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format plans with company count
    const formattedPlans = plans.map((plan) => ({
      ...plan,
      companyCount: plan._count.company_hqs,
    }));

    return NextResponse.json({
      success: true,
      plans: formattedPlans,
    });
  } catch (error) {
    console.error('❌ Get plans error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get plans',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

