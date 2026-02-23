import Stripe from "stripe";
import { getOrCreateStripeCustomer } from "./customer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type Retainer = {
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

/**
 * Create one-time Stripe Checkout session for a retainer (one-off payment).
 * Same pattern as bills: mode 'payment', no subscription. Gives control for
 * upcharge, summary of items, etc. Monthly repeat is handled later by cron/service
 * that creates a new bill or payment opportunity and sends the link.
 */
export async function createRetainerCheckoutSession({
  retainer,
  company,
  successUrl,
  cancelUrl,
}: {
  retainer: Retainer;
  company: Company;
  successUrl: string;
  cancelUrl: string;
}) {
  const customerId = await getOrCreateStripeCustomer(company);

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: retainer.currency.toLowerCase(),
          product_data: {
            name: retainer.name,
            ...(retainer.description && { description: retainer.description }),
          },
          unit_amount: retainer.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: {
      type: "company_retainer",
      retainerId: retainer.id,
      companyId: company.id,
    },
  };

  return stripe.checkout.sessions.create(params);
}
