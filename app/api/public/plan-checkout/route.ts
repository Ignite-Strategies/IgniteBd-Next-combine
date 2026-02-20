import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCheckoutSession } from '@/lib/stripe/checkout';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'company';
}

/**
 * POST /api/public/plan-checkout
 *
 * Public (no auth). Create a Stripe Checkout session for a plan assigned to a company.
 * Used by the public plan-checkout page so you can send a single URL to the customer.
 *
 * Body: { companySlug: string, planId: string, successUrl?: string, cancelUrl?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      companySlug,
      planId,
      successUrl: successUrlBody,
      cancelUrl: cancelUrlBody,
    } = body ?? {};

    if (!companySlug?.trim() || !planId?.trim()) {
      return NextResponse.json(
        { success: false, error: 'companySlug and planId are required' },
        { status: 400 }
      );
    }

    const slug = String(companySlug).trim().toLowerCase();
    const planIdTrim = String(planId).trim();

    const companies = await prisma.company_hqs.findMany({
      where: { planId: planIdTrim },
      include: {
        plans: true,
      },
    });

    const company = companies.find((c) => slugify(c.companyName) === slug);
    if (!company || !company.plans) {
      return NextResponse.json(
        { success: false, error: 'Company or plan not found for this link' },
        { status: 404 }
      );
    }

    if (company.plans.id !== planIdTrim) {
      return NextResponse.json(
        { success: false, error: 'Plan does not match company' },
        { status: 400 }
      );
    }

    const origin =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      '';
    const protocol = request.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const base = `${protocol}://${origin}`;
    const successUrl =
      successUrlBody?.trim() || `${base}/plan-checkout/success`;
    const cancelUrl =
      cancelUrlBody?.trim() || `${base}/plan-checkout/canceled`;

    const session = await createCheckoutSession({
      company: {
        id: company.id,
        companyName: company.companyName,
        stripeCustomerId: company.stripeCustomerId,
        planStartedAt: company.planStartedAt,
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
      cancelUrl,
    });

    const url = session.url;
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('❌ Public plan-checkout error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create checkout',
      },
      { status: 500 }
    );
  }
}
