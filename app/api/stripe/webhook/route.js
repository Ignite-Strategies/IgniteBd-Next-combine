import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import PlatformAccessService from '@/lib/services/platformAccessService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/stripe/webhook
 * 
 * Stripe Webhook Handler (AUTHORITATIVE SIGNAL)
 * 
 * Responsibilities:
 * - Verify Stripe signature
 * - Parse event
 * - Call PlatformAccessService
 * - No direct DB logic in route
 * 
 * Webhook → Access Mapping:
 * - invoice.payment_succeeded → ensureActive()
 * - customer.subscription.deleted → revokeAccess()
 * - invoice.payment_failed → optional pauseAccess()
 */
export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('❌ Missing Stripe signature');
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 },
    );
  }

  let event;

  try {
    // Verify Stripe signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error('❌ Webhook signature verification failed:', error.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${error.message}` },
      { status: 400 },
    );
  }

  try {
    // Parse event and call PlatformAccessService
    const eventType = event.type;
    const eventData = event.data.object;

    console.log(`📥 Stripe webhook received: ${eventType}`);

    switch (eventType) {
      case 'invoice.payment_succeeded': {
        // Payment succeeded → ensure active access
        const subscriptionId = eventData.subscription;
        if (!subscriptionId) {
          console.warn('⚠️ invoice.payment_succeeded: No subscription ID');
          break;
        }

        // Get subscription to access metadata
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const companyId = subscription.metadata?.companyId;
        const planId = subscription.metadata?.planId;

        if (companyId && planId) {
          await PlatformAccessService.ensureActive(
            companyId,
            planId,
            subscriptionId
          );
          console.log(`✅ Access activated for company ${companyId}`);
        } else {
          // Fallback: try to find existing PlatformAccess
          const platformAccess = await prisma.platform_accesses.findUnique({
            where: { stripeSubscriptionId: subscriptionId },
          });

          if (platformAccess) {
            await PlatformAccessService.ensureActive(
              platformAccess.companyId,
              platformAccess.planId,
              subscriptionId
            );
            console.log(`✅ Access activated for company ${platformAccess.companyId} (from existing access)`);
          } else {
            console.warn('⚠️ Could not find company/plan for subscription:', subscriptionId);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription deleted → revoke access
        const subscriptionId = eventData.id;

        const platformAccess = await prisma.platform_accesses.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        });

        if (platformAccess) {
          await PlatformAccessService.revokeAccess(platformAccess.id);
          console.log(`✅ Access revoked for platform access ${platformAccess.id}`);
        } else {
          console.warn('⚠️ Could not find platform access for subscription:', subscriptionId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        // Payment failed → optional pause access
        const subscriptionId = eventData.subscription;
        if (!subscriptionId) {
          console.warn('⚠️ invoice.payment_failed: No subscription ID');
          break;
        }

        const platformAccess = await prisma.platform_accesses.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        });

        if (platformAccess) {
          // Optional: pause access on payment failure
          // Uncomment if you want to pause on payment failure
          // await PlatformAccessService.pauseAccess(platformAccess.id);
          console.log(`⚠️ Payment failed for subscription ${subscriptionId} (access not paused)`);
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled webhook event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 },
    );
  }
}

