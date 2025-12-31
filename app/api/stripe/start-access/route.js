import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import StripeAccessService from '@/lib/services/stripeAccessService';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/stripe/start-access
 * 
 * Stripe Access Execution (MECHANISM ONLY)
 * 
 * Creates Stripe subscription for access.
 * DO NOT activate PlatformAccess here.
 * PlatformAccess is activated by webhook when payment succeeds.
 * 
 * Payload:
 * {
 *   companyId: "uuid",
 *   planId: "uuid"
 * }
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { companyId, planId } = body ?? {};

    if (!companyId || !planId) {
      return NextResponse.json(
        { error: 'companyId and planId are required' },
        { status: 400 },
      );
    }

    // Create Stripe subscription
    const stripeSubscriptionId = await StripeAccessService.createAccessSubscription(
      companyId,
      planId
    );

    // Retrieve subscription details for client
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['latest_invoice.payment_intent'],
    });

    // Return subscription/client info
    return NextResponse.json({
      success: true,
      stripeSubscriptionId,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
      },
    });
  } catch (error) {
    console.error('❌ Error starting Stripe access:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start Stripe access' },
      { status: 500 },
    );
  }
}

