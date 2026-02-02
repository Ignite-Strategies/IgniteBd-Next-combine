import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * MINIMAL TEST: What does Stripe actually need?
 * 
 * Stripe's absolute minimum requirements:
 * 1. line_items (what you're selling) OR payment_intent_data
 * 2. success_url (where to go after payment)
 * 3. cancel_url (where to go if cancelled)
 * 
 * That's it. Everything else is optional.
 */
export async function testMinimalStripeCheckout() {
  console.log('[STRIPE_TEST] Creating MINIMAL checkout session...');
  
  // ABSOLUTE MINIMUM - Stripe only needs these 3 things:
  const minimalParams = {
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Test Payment',
          },
          unit_amount: 1000, // $10.00 in cents
        },
        quantity: 1,
      },
    ],
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
  };

  console.log('[STRIPE_TEST] Minimal params:', JSON.stringify(minimalParams, null, 2));

  try {
    const session = await stripe.checkout.sessions.create(minimalParams);
    
    console.log('[STRIPE_TEST] ✅ SUCCESS! Session created:', {
      id: session.id,
      url: session.url,
      status: session.status,
    });
    
    return session;
  } catch (error: any) {
    console.error('[STRIPE_TEST] ❌ FAILED:', {
      message: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
    });
    throw error;
  }
}

/**
 * TEST WITH CUSTOMER: Add customer ID (optional but recommended)
 */
export async function testStripeCheckoutWithCustomer(customerId: string) {
  console.log('[STRIPE_TEST] Creating checkout session WITH customer:', customerId);
  
  const params = {
    mode: 'payment' as const,
    customer: customerId, // Optional - links payment to customer
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Test Payment',
          },
          unit_amount: 1000,
        },
        quantity: 1,
      },
    ],
    success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://example.com/cancel',
  };

  console.log('[STRIPE_TEST] Params with customer:', JSON.stringify(params, null, 2));

  try {
    const session = await stripe.checkout.sessions.create(params);
    
    console.log('[STRIPE_TEST] ✅ SUCCESS with customer! Session created:', {
      id: session.id,
      url: session.url,
      status: session.status,
      customer: session.customer,
    });
    
    return session;
  } catch (error: any) {
    console.error('[STRIPE_TEST] ❌ FAILED with customer:', {
      message: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
    });
    throw error;
  }
}
