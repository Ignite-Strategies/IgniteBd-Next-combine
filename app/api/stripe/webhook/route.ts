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
 * Handles both:
 * 1. Plan subscriptions (companyHQId + planId)
 * 2. One-off bills (billId + companyId)
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    const billId = session.metadata?.billId;
    const companyHQId = session.metadata?.companyHQId;
    const planId = session.metadata?.planId;
    const type = session.metadata?.type;

    // Handle one-off bill payment
    if (billId && type === 'one_off_bill') {
      // Find bill by billId from metadata (sessions are ephemeral, bills are durable)
      const bill = await prisma.bills.findUnique({
        where: { id: billId },
      });

      if (bill) {
        // Only update if bill is still PENDING (idempotent - safe to receive duplicate webhooks)
        if (bill.status === 'PENDING') {
          await prisma.bills.update({
            where: { id: bill.id },
            data: {
              status: 'PAID',
              paidAt: new Date(), // Capture payment timestamp
              updatedAt: new Date(),
            },
          });

          console.log(`✅ Bill payment completed: Bill ${bill.id} set to PAID at ${new Date().toISOString()}`);
        } else {
          console.log(`ℹ️ Bill ${bill.id} already marked as ${bill.status}, skipping update (idempotent)`);
        }
      } else {
        console.warn(`⚠️ checkout.session.completed: Bill not found for billId ${billId}`);
      }
      return;
    }

    // Handle plan subscription payment
    if (companyHQId && planId) {
      // Update company_hqs directly
      await prisma.company_hqs.update({
        where: { id: companyHQId },
        data: {
          planStatus: 'ACTIVE',
          planId: planId, // Ensure planId is set
          stripeSubscriptionId: session.subscription as string | null, // Set if subscription, null if one-time
          planStartedAt: new Date(),
          planEndedAt: null,
        },
      });

      if (session.subscription) {
        console.log(`✅ Subscription checkout completed: Company ${companyHQId} set to ACTIVE with subscription ${session.subscription}`);
      } else {
        console.log(`✅ One-time payment completed: Company ${companyHQId} set to ACTIVE`);
      }
      return;
    }

    console.warn('⚠️ checkout.session.completed: Missing required metadata (billId+type or companyHQId+planId)');
  } catch (error) {
    console.error('❌ Error handling checkout.session.completed:', error);
    throw error;
  }
}

/**
 * Handle invoice.paid
 * Update company_hqs by stripeSubscriptionId, set planStatus = ACTIVE
 * Also write to invoices table for payment history
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string | null;
    const invoiceId = invoice.id;
    const amountPaid = invoice.amount_paid; // in cents
    const currency = invoice.currency || 'usd';
    const customerId = invoice.customer as string | null;

    if (!subscriptionId) {
      console.warn('⚠️ invoice.paid: No subscription ID');
      return;
    }

    // Find company by subscription ID
    const company = await prisma.company_hqs.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      include: {
        plans: true, // Get plan info for invoice name/description
      },
    });

    if (!company) {
      console.warn(`⚠️ invoice.paid: Company not found for subscription ${subscriptionId}`);
      return;
    }

    // Update company_hqs status
    await prisma.company_hqs.update({
      where: { id: company.id },
      data: {
        planStatus: 'ACTIVE',
        planEndedAt: null,
      },
    });

    // Write to invoices table for payment history
    const planName = company.plans?.name || 'Plan Subscription';
    const invoiceDescription = company.plans?.description || `Subscription payment for ${planName}`;

    // Upsert invoice (create if doesn't exist, update if it does)
    await prisma.invoices.upsert({
      where: { stripeInvoiceId: invoiceId },
      create: {
        companyHQId: company.id,
        invoiceType: 'PLAN_SUBSCRIPTION',
        invoiceName: planName,
        invoiceDescription: invoiceDescription,
        totalExpected: amountPaid,
        totalReceived: amountPaid,
        currency: currency.toUpperCase(),
        status: 'PAID',
        paidAt: new Date(),
        stripeInvoiceId: invoiceId,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        stripePaymentIntentId: invoice.payment_intent as string | null,
      },
      update: {
        totalReceived: amountPaid,
        status: 'PAID',
        paidAt: new Date(),
        stripePaymentIntentId: invoice.payment_intent as string | null,
      },
    });

    console.log(`✅ Invoice paid: Company ${company.id} set to ACTIVE, payment history saved (invoice ${invoiceId})`);
  } catch (error) {
    console.error('❌ Error handling invoice.paid:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed
 * Update company_hqs by stripeSubscriptionId, set planStatus = PAST_DUE
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string | null;

    if (!subscriptionId) {
      console.warn('⚠️ invoice.payment_failed: No subscription ID');
      return;
    }

    const company = await prisma.company_hqs.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (company) {
      await prisma.company_hqs.update({
        where: { id: company.id },
        data: {
          planStatus: 'PAST_DUE',
        },
      });

      console.log(`⚠️ Payment failed: Company ${company.id} set to PAST_DUE`);
    } else {
      console.warn(`⚠️ invoice.payment_failed: Company not found for subscription ${subscriptionId}`);
    }
  } catch (error) {
    console.error('❌ Error handling invoice.payment_failed:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.updated
 * Update company_hqs status based on subscription status
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const company = await prisma.company_hqs.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (company) {
      // Update status based on subscription status
      let status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' = 'ACTIVE';

      if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
        status = 'PAST_DUE';
      } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
        status = 'CANCELED';
        await prisma.company_hqs.update({
          where: { id: company.id },
          data: {
            planStatus: 'CANCELED',
            planEndedAt: new Date(),
          },
        });
        console.log(`✅ Subscription updated: Company ${company.id} set to CANCELED`);
        return;
      }

      await prisma.company_hqs.update({
        where: { id: company.id },
        data: {
          planStatus: status,
        },
      });

      console.log(`✅ Subscription updated: Company ${company.id} set to ${status}`);
    } else {
      console.warn(`⚠️ customer.subscription.updated: Company not found for subscription ${subscription.id}`);
    }
  } catch (error) {
    console.error('❌ Error handling customer.subscription.updated:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.deleted
 * Update company_hqs: set planStatus = CANCELED, planEndedAt = now()
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const company = await prisma.company_hqs.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (company) {
      await prisma.company_hqs.update({
        where: { id: company.id },
        data: {
          planStatus: 'CANCELED',
          planEndedAt: new Date(),
        },
      });

      console.log(`✅ Subscription deleted: Company ${company.id} set to CANCELED`);
    } else {
      console.warn(`⚠️ customer.subscription.deleted: Company not found for subscription ${subscription.id}`);
    }
  } catch (error) {
    console.error('❌ Error handling customer.subscription.deleted:', error);
    throw error;
  }
}

