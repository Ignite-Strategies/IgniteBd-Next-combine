import Stripe from 'stripe';
import { getOrCreateStripeCustomer } from './customer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type Bill = {
  id: string;
  name: string;
  description?: string | null;
  amountCents: number;
  currency: string;
};

type Company = {
  id: string;
  companyName: string;
  stripeCustomerId: string | null;
};

// IMPORTANT:
// Bills are durable DB objects.
// Stripe Checkout Sessions are ephemeral payment windows.
// We intentionally create a new Checkout Session per page load
// and never store or reuse session IDs.

/**
 * Create one-time Stripe Checkout session for a bill (one-off billing).
 * Uses price_data (no plan/product). Mode 'payment' only.
 * Returns public URL for client to pay.
 * 
 * This function is called on every bill page load to create a fresh session.
 * Sessions are never stored or reused - they're disposable payment windows.
 */
export async function createBillCheckoutSession({
  bill,
  company,
  successUrl,
  cancelUrl,
}: {
  bill: Bill;
  company: Company;
  successUrl: string;
  cancelUrl: string;
}) {
  console.log('[STRIPE_CHECKOUT] Creating session:', {
    billId: bill.id,
    billName: bill.name,
    amountCents: bill.amountCents,
    currency: bill.currency,
    companyId: company.id,
    companyName: company.companyName,
    hasStripeCustomerId: !!company.stripeCustomerId,
  });

  const customerId = await getOrCreateStripeCustomer(company);
  console.log('[STRIPE_CHECKOUT] Customer ID:', customerId);

  // Set expiration to 24 hours (Stripe's maximum)
  // Note: Expiration doesn't matter for correctness - we create new sessions on each page load
  const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours in seconds

  const sessionParams = {
    mode: 'payment' as const,
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: bill.currency.toLowerCase(),
          product_data: {
            name: bill.name,
            ...(bill.description && { description: bill.description }),
          },
          unit_amount: bill.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    expires_at: expiresAt,
    metadata: {
      billId: bill.id,
      companyId: company.id,
      type: 'one_off_bill',
    },
  };

  console.log('[STRIPE_CHECKOUT] Session params:', {
    mode: sessionParams.mode,
    customer: sessionParams.customer,
    amountCents: sessionParams.line_items[0].price_data.unit_amount,
    currency: sessionParams.line_items[0].price_data.currency,
    expires_at: sessionParams.expires_at, // CRITICAL: Log expiration to catch issues
    expires_at_hours: Math.floor((sessionParams.expires_at - Math.floor(Date.now() / 1000)) / 3600), // Hours until expiration
  });

  const session = await stripe.checkout.sessions.create(sessionParams);

  console.log('[STRIPE_CHECKOUT] Session created:', {
    id: session.id,
    url: session.url,
    status: session.status,
  });

  return session;
}
