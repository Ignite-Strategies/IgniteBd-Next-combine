import { NextResponse } from 'next/server';
import { testMinimalStripeCheckout, testStripeCheckoutWithCustomer } from '@/lib/stripe/testCheckout';

/**
 * TEST ENDPOINT: Verify Stripe checkout session creation
 * 
 * GET /api/test-stripe - Test minimal checkout
 * GET /api/test-stripe?customer=cus_xxx - Test with customer ID
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer');

    if (customerId) {
      // Test with customer ID
      const session = await testStripeCheckoutWithCustomer(customerId);
      return NextResponse.json({
        success: true,
        message: 'Checkout session created with customer',
        session: {
          id: session.id,
          url: session.url,
          status: session.status,
          customer: session.customer,
        },
      });
    } else {
      // Test minimal (no customer)
      const session = await testMinimalStripeCheckout();
      return NextResponse.json({
        success: true,
        message: 'Minimal checkout session created',
        session: {
          id: session.id,
          url: session.url,
          status: session.status,
        },
      });
    }
  } catch (error: any) {
    console.error('[TEST_STRIPE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        type: error.type,
        code: error.code,
        param: error.param,
      },
      { status: 500 }
    );
  }
}
