import Stripe from "stripe";
import { getOrCreateStripeCustomer } from "./customer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type Retainer = {
  id: string;
  name: string;
  description?: string | null;
  amountCents: number;
  currency: string;
  startDate?: Date | null;
};

type Company = {
  id: string;
  companyName: string;
  stripeCustomerId: string | null;
};

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

  const startDate =
    retainer.startDate instanceof Date
      ? retainer.startDate
      : retainer.startDate
      ? new Date(retainer.startDate)
      : null;
  const billingCycleAnchor =
    startDate && startDate.getTime() > Date.now()
      ? Math.floor(startDate.getTime() / 1000)
      : undefined;

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
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
          recurring: {
            interval: "month",
          },
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
    ...(billingCycleAnchor && {
      subscription_data: {
        billing_cycle_anchor: billingCycleAnchor,
        proration_behavior: "none",
      },
    }),
  };

  return stripe.checkout.sessions.create(params);
}
