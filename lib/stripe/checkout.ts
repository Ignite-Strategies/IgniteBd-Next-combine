import Stripe from 'stripe';
import { getOrCreateStripeCustomer } from './customer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type CompanyHQ = {
  id: string;
  companyName: string;
  stripeCustomerId: string | null;
};

type Plan = {
  id: string;
  name: string;
  currency: string;
  amountCents: number;
  interval: 'MONTH' | 'YEAR' | null;
};

/**
 * Create Stripe checkout session
 * 
 * @param params - Checkout session parameters
 * @returns Stripe checkout session
 */
export async function createCheckoutSession({
  company,
  plan,
  successUrl,
}: {
  company: CompanyHQ;
  plan: Plan;
  successUrl: string;
}) {
  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(company);

  // Determine mode: subscription if interval exists, payment if one-time
  const mode: 'subscription' | 'payment' = plan.interval ? 'subscription' : 'payment';

  // Build line items
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: plan.currency,
        product_data: { name: plan.name },
        unit_amount: plan.amountCents,
        ...(plan.interval && {
          recurring: {
            interval: plan.interval.toLowerCase() as 'month' | 'year',
          },
        }),
      },
      quantity: 1,
    },
  ];

  // Create checkout session
  return stripe.checkout.sessions.create({
    mode,
    ui_mode: 'embedded',
    customer: customerId,
    line_items: lineItems,
    return_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    metadata: {
      companyHQId: company.id,
      planId: plan.id,
    },
  });
}

