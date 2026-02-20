import Stripe from 'stripe';
import { getOrCreateStripeCustomer } from './customer';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type CompanyHQ = {
  id: string;
  companyName: string;
  stripeCustomerId: string | null;
  planStartedAt?: Date | string | null;
};

type Plan = {
  id: string;
  name: string;
  description?: string | null;
  currency: string;
  amountCents: number;
  interval: 'MONTH' | 'YEAR' | null;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
};

/**
 * Create Stripe checkout session
 * 
 * Creates Stripe product/price if they don't exist, saves IDs to plan for reuse.
 * 
 * @param params - Checkout session parameters
 * @returns Stripe checkout session
 */
export async function createCheckoutSession({
  company,
  plan,
  successUrl,
  cancelUrl,
}: {
  company: CompanyHQ;
  plan: Plan;
  successUrl: string;
  cancelUrl?: string;
}) {
  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(company);

  // Determine mode: subscription if interval exists, payment if one-time
  const mode: 'subscription' | 'payment' = plan.interval ? 'subscription' : 'payment';

  // Get Stripe price ID (should exist from plan creation, but create if missing)
  let priceId = plan.stripePriceId;

  if (!priceId) {
    // Fallback: Create Stripe product/price if they don't exist
    // (This shouldn't happen if plan was created via API, but handle edge cases)
    const { createStripeProductAndPrice } = await import('./plan');
    const { priceId: newPriceId } = await createStripeProductAndPrice(plan.id);
    priceId = newPriceId || null;
    
    if (!priceId) {
      throw new Error('Failed to create Stripe price for plan');
    }
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price: priceId,
      quantity: 1,
    },
  ];

  const startedAt =
    company.planStartedAt instanceof Date
      ? company.planStartedAt
      : company.planStartedAt
        ? new Date(company.planStartedAt)
        : null;
  const billingCycleAnchor =
    mode === 'subscription' &&
    startedAt &&
    startedAt.getTime() > Date.now()
      ? Math.floor(startedAt.getTime() / 1000)
      : undefined;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode,
    customer: customerId,
    line_items: lineItems,
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${successUrl}?canceled=true`,
    metadata: {
      companyHQId: company.id,
      planId: plan.id,
    },
    ...(billingCycleAnchor && {
      subscription_data: {
        billing_cycle_anchor: billingCycleAnchor,
        proration_behavior: 'none',
      },
    }),
  };

  return stripe.checkout.sessions.create(sessionParams);
}

