import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { createCheckoutSession } from '@/lib/stripe/checkout';

/**
 * POST /api/stripe/checkout
 * 
 * Create Stripe checkout session for company's plan
 * 
 * Request body:
 * {
 *   companyHQId: string,
 *   planId: string,
 *   successUrl: string
 * }
 */
export async function POST(request: Request) {
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
    const { companyHQId, planId, successUrl } = body;

    if (!companyHQId || !planId || !successUrl) {
      return NextResponse.json(
        { error: 'companyHQId, planId, and successUrl are required' },
        { status: 400 },
      );
    }

    // Fetch company with plan
    const company = await prisma.company_hqs.findUnique({
      where: { id: companyHQId },
      include: {
        plans: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 },
      );
    }

    if (!company.plans) {
      return NextResponse.json(
        { error: 'Company has no plan assigned' },
        { status: 400 },
      );
    }

    if (company.plans.id !== planId) {
      return NextResponse.json(
        { error: 'Plan ID does not match company plan' },
        { status: 400 },
      );
    }

    // Create checkout session using plan data
    const session = await createCheckoutSession({
      company: {
        id: company.id,
        companyName: company.companyName,
        stripeCustomerId: company.stripeCustomerId,
      },
      plan: {
        id: company.plans.id,
        name: company.plans.name,
        description: company.plans.description,
        amountCents: company.plans.amountCents,
        currency: company.plans.currency,
        interval: company.plans.interval,
        stripeProductId: company.plans.stripeProductId,
        stripePriceId: company.plans.stripePriceId,
      },
      successUrl,
    });

    // Return session ID and URL for redirect
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url, // For redirect checkout
      clientSecret: session.client_secret, // For embedded checkout (if needed)
    });
  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}


