import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Create Stripe product and price for a plan
 * Called when plan is created (not on checkout)
 * 
 * @param planId - Plan ID
 * @returns Stripe product and price IDs
 */
export async function createStripeProductAndPrice(planId: string) {
  // Fetch plan
  const plan = await prisma.plans.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }

  // If Stripe IDs already exist, return them
  if (plan.stripeProductId && plan.stripePriceId) {
    return {
      productId: plan.stripeProductId,
      priceId: plan.stripePriceId,
    };
  }

  // Create Stripe Product
  const product = await stripe.products.create({
    name: plan.name,
    description: plan.description || undefined,
  });
  // Stripe returns: { id: "prod_xxxxx", ... }

  // Create Stripe Price (if we have all the info)
  let priceId: string | null = null;
  
  if (plan.amountCents > 0 && plan.currency) {
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amountCents,
      currency: plan.currency.toLowerCase(),
      ...(plan.interval && {
        recurring: {
          interval: plan.interval.toLowerCase() as 'month' | 'year',
        },
      }),
    });
    // Stripe returns: { id: "price_xxxxx", ... }
    priceId = price.id;
  }

  // Save IDs to plan
  await prisma.plans.update({
    where: { id: planId },
    data: {
      stripeProductId: product.id,
      ...(priceId && { stripePriceId: priceId }),
    },
  });

  return {
    productId: product.id,
    priceId: priceId,
  };
}

/**
 * Get Stripe product ID for a plan (creates if doesn't exist)
 * Simple API to get product ID without initiating checkout
 * 
 * @param planId - Plan ID
 * @returns Stripe product ID
 */
export async function getOrCreateStripeProductId(planId: string): Promise<string> {
  const plan = await prisma.plans.findUnique({
    where: { id: planId },
    select: { stripeProductId: true },
  });

  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }

  // If product ID exists, return it
  if (plan.stripeProductId) {
    return plan.stripeProductId;
  }

  // Create product/price (will create both)
  const { productId } = await createStripeProductAndPrice(planId);
  return productId;
}

