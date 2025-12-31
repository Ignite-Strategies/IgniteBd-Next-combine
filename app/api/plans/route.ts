import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/plans
 * Create a new plan
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

    // Create plan
    const plan = await prisma.plans.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        amountCents: Math.round(amountCents), // Ensure integer
        currency: currency?.toLowerCase() || 'usd',
        interval: interval || null, // null for one-time payments
      },
    });

    return NextResponse.json({
      success: true,
      plan,
    });
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      plans,
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

