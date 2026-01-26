import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getOrCreateStripeProductId } from '@/lib/stripe/plan';

/**
 * GET /api/plans/[id]/stripe-product
 * Get Stripe product ID for a plan (creates if doesn't exist)
 * Simple API to get product ID without initiating checkout
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

    const productId = await getOrCreateStripeProductId(id);

    return NextResponse.json({
      success: true,
      planId: id,
      stripeProductId: productId,
    });
  } catch (error) {
    console.error('❌ Get Stripe product ID error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Stripe product ID',
      },
      { status: 500 },
    );
  }
}

