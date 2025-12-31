import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import StripeCustomerService from './stripeCustomerService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * StripeAccessService
 * 
 * Handles Stripe subscription creation for access.
 * This is the mechanism - it does NOT activate PlatformAccess.
 * PlatformAccessService is authoritative for access state.
 */
class StripeAccessService {
  /**
   * Create Stripe subscription for access
   * 
   * @param {string} companyId - CompanyHQ.id
   * @param {string} planId - Plan.id
   * @returns {Promise<string>} Stripe subscription ID (sub_...)
   */
  static async createAccessSubscription(companyId, planId) {
    // Fetch CompanyHQ + Plan
    const [company, plan] = await Promise.all([
      prisma.company_hqs.findUnique({
        where: { id: companyId },
        select: { id: true, companyName: true },
      }),
      prisma.plans.findUnique({
        where: { id: planId },
        select: {
          id: true,
          name: true,
          stripePriceId: true,
          interval: true,
        },
      }),
    ]);

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    if (!plan.stripePriceId) {
      throw new Error(`Plan ${planId} does not have a Stripe price ID`);
    }

    // Resolve stripeCustomerId (creates if missing)
    const stripeCustomerId = await StripeCustomerService.getOrCreateCustomerForCompany(companyId);

    // Use plan.stripePriceId to create Stripe subscription
    // Include metadata so webhook can find company/plan
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [
        {
          price: plan.stripePriceId,
        },
      ],
      metadata: {
        companyId: company.id,
        planId: plan.id,
      },
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscribe' },
      expand: ['latest_invoice.payment_intent'],
    });

    // Return stripeSubscriptionId
    return subscription.id;
  }
}

export default StripeAccessService;

