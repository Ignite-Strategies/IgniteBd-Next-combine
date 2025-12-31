import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Get or create Stripe customer for a CompanyHQ
 * 
 * @param company - CompanyHQ record
 * @returns Stripe customer ID
 */
export async function getOrCreateStripeCustomer(company: { id: string; companyName: string; stripeCustomerId: string | null }) {
  // Return existing customer ID if present
  if (company.stripeCustomerId) {
    return company.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    name: company.companyName,
    metadata: { companyHQId: company.id },
  });

  // Update CompanyHQ with Stripe customer ID
  await prisma.company_hqs.update({
    where: { id: company.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

