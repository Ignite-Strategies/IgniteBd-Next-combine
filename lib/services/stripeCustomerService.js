import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * StripeCustomerService
 * 
 * Handles Stripe customer creation and retrieval for companies.
 * Stripe customer is company-scoped and created lazily on first access attempt.
 */
class StripeCustomerService {
  /**
   * Get or create Stripe customer for a company
   * 
   * @param {string} companyId - CompanyHQ.id
   * @returns {Promise<string>} Stripe customer ID (cus_...)
   */
  static async getOrCreateCustomerForCompany(companyId) {
    // Read CompanyHQ
    const company = await prisma.company_hqs.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyName: true,
        stripeCustomerId: true,
      },
    });

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    // If customer already exists, return it
    if (company.stripeCustomerId) {
      return company.stripeCustomerId;
    }

    // Create Stripe customer if missing
    const stripeCustomer = await stripe.customers.create({
      name: company.companyName || 'Company',
      metadata: {
        companyId: company.id,
      },
    });

    // Persist stripeCustomerId
    await prisma.company_hqs.update({
      where: { id: companyId },
      data: {
        stripeCustomerId: stripeCustomer.id,
      },
    });

    return stripeCustomer.id;
  }
}

export default StripeCustomerService;

