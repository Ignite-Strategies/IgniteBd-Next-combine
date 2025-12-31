import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/stripe/webhook
 * 
 * Stripe Webhook Handler (Authoritative)
 * 
 * Endpoint: https://app.ignitegrowth.biz/api/stripe/webhook
 * Payload style: Snapshot
 * API version: 2025-08-27.basil
 * 
 * Requirements:
 * - Must always return 200 with { received: true }
 * - Must verify Stripe signature
 * - Must switch on event.type
 * - Must be idempotent (safe to receive duplicates)
 * 
 * Events Handled:
 * - checkout.session.completed
 * - invoice.paid
 * - invoice.payment_failed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 */
export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      console.error('❌ Missing Stripe signature or webhook secret');
      return NextResponse.json(
        { received: true, error: 'Missing signature or webhook secret' },
        { status: 200 }, // Always return 200
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      return NextResponse.json(
        { received: true, error: `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
        { status: 200 }, // Always return 200
      );
    }

    // Switch on event.type
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'invoice.paid': {
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      }

      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      }

      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled webhook event type: ${event.type}`);
    }

    // Always return 200 with { received: true }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    // Always return 200 even on error (idempotent)
    return NextResponse.json({ received: true, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Handle checkout.session.completed
 * If one-time payment: Create or update PlatformAccess, set status = ACTIVE, no subscription ID
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    const companyHQId = session.metadata?.companyHQId;
    const planId = session.metadata?.planId;

    if (!companyHQId || !planId) {
      console.warn('⚠️ checkout.session.completed: Missing companyHQId or planId in metadata');
      return;
    }

    // Check if this is a one-time payment (no subscription)
    if (!session.subscription) {
      // One-time payment: Create or update PlatformAccess
      await prisma.platform_accesses.upsert({
        where: {
          companyId_planId: {
            companyId: companyHQId,
            planId: planId,
          },
        },
        create: {
          companyId: companyHQId,
          planId: planId,
          status: 'ACTIVE',
          stripeSubscriptionId: null, // No subscription for one-time
          startedAt: new Date(),
        },
        update: {
          status: 'ACTIVE',
          startedAt: new Date(),
          endedAt: null,
        },
      });

      console.log(`✅ One-time payment completed: PlatformAccess ACTIVE for company ${companyHQId}, plan ${planId}`);
    } else {
      // Subscription payment: handled by invoice.paid
      console.log(`ℹ️ Subscription checkout completed: Will be handled by invoice.paid event`);
    }
  } catch (error) {
    console.error('❌ Error handling checkout.session.completed:', error);
    throw error;
  }
}

/**
 * Handle invoice.paid
 * Lookup stripeSubscriptionId, set PlatformAccess.status = ACTIVE
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string | null;

    if (!subscriptionId) {
      console.warn('⚠️ invoice.paid: No subscription ID');
      return;
    }

    // Find PlatformAccess by subscription ID
    const platformAccess = await prisma.platform_accesses.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (platformAccess) {
      await prisma.platform_accesses.update({
        where: { id: platformAccess.id },
        data: {
          status: 'ACTIVE',
          endedAt: null,
        },
      });

      console.log(`✅ Invoice paid: PlatformAccess ${platformAccess.id} set to ACTIVE`);
    } else {
      console.warn(`⚠️ invoice.paid: PlatformAccess not found for subscription ${subscriptionId}`);
    }
  } catch (error) {
    console.error('❌ Error handling invoice.paid:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed
 * Set PlatformAccess.status = PAST_DUE
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string | null;

    if (!subscriptionId) {
      console.warn('⚠️ invoice.payment_failed: No subscription ID');
      return;
    }

    const platformAccess = await prisma.platform_accesses.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (platformAccess) {
      await prisma.platform_accesses.update({
        where: { id: platformAccess.id },
        data: {
          status: 'PAST_DUE',
        },
      });

      console.log(`⚠️ Payment failed: PlatformAccess ${platformAccess.id} set to PAST_DUE`);
    } else {
      console.warn(`⚠️ invoice.payment_failed: PlatformAccess not found for subscription ${subscriptionId}`);
    }
  } catch (error) {
    console.error('❌ Error handling invoice.payment_failed:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.updated
 * Update PlatformAccess if needed (e.g., plan change)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const platformAccess = await prisma.platform_accesses.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (platformAccess) {
      // Update status based on subscription status
      let status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' = 'ACTIVE';

      if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
        status = 'PAST_DUE';
      } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
        status = 'CANCELED';
        await prisma.platform_accesses.update({
          where: { id: platformAccess.id },
          data: {
            status: 'CANCELED',
            endedAt: new Date(),
          },
        });
        console.log(`✅ Subscription updated: PlatformAccess ${platformAccess.id} set to CANCELED`);
        return;
      }

      await prisma.platform_accesses.update({
        where: { id: platformAccess.id },
        data: {
          status,
        },
      });

      console.log(`✅ Subscription updated: PlatformAccess ${platformAccess.id} set to ${status}`);
    } else {
      console.warn(`⚠️ customer.subscription.updated: PlatformAccess not found for subscription ${subscription.id}`);
    }
  } catch (error) {
    console.error('❌ Error handling customer.subscription.updated:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.deleted
 * Set PlatformAccess.status = CANCELED, set endedAt = now()
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const platformAccess = await prisma.platform_accesses.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (platformAccess) {
      await prisma.platform_accesses.update({
        where: { id: platformAccess.id },
        data: {
          status: 'CANCELED',
          endedAt: new Date(),
        },
      });

      console.log(`✅ Subscription deleted: PlatformAccess ${platformAccess.id} set to CANCELED`);
    } else {
      console.warn(`⚠️ customer.subscription.deleted: PlatformAccess not found for subscription ${subscription.id}`);
    }
  } catch (error) {
    console.error('❌ Error handling customer.subscription.deleted:', error);
    throw error;
  }
}

