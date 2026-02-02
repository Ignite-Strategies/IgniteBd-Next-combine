# Stripe Checkout Session - What We Actually Send

## Stripe's Absolute Minimum Requirements

Stripe only requires **3 things** to create a checkout session:

1. **`line_items`** - What you're selling (price, product name, quantity)
2. **`success_url`** - Where to redirect after successful payment
3. **`cancel_url`** - Where to redirect if payment is cancelled

**That's it.** Everything else is optional.

## What We're Currently Sending

```typescript
{
  // REQUIRED ✅
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: { name: 'Bill Name' },
      unit_amount: 10000, // amount in cents
    },
    quantity: 1,
  }],
  success_url: 'https://...',
  cancel_url: 'https://...',
  
  // OPTIONAL (but we include them)
  mode: 'payment',              // Optional - defaults to 'payment'
  customer: 'cus_xxx',         // Optional - links payment to customer
  // expires_at: REMOVED - Stripe defaults to 24 hours, we don't need it
  metadata: {                   // Optional - just for our tracking
    billId: 'xxx',
    companyId: 'xxx',
    type: 'one_off_bill',
  },
}
```

**Note:** We removed `expires_at` because:
- Stripe defaults to 24 hours automatically
- It's not required
- We were setting it wrong (7 days > 24 hour limit) and causing errors
- Since we create new sessions on each page load, expiration doesn't matter anyway

## What Could Go Wrong?

### 1. Customer ID is Invalid
- If `customer: 'cus_xxx'` doesn't exist in Stripe, the API call will fail
- Check: Does `company.stripeCustomerId` actually exist in Stripe?

### 2. Customer Creation Fails
- If `getOrCreateStripeCustomer()` throws an error, we never create the session
- Check: Are there any errors in `getOrCreateStripeCustomer()`?

### 3. Stripe API Key is Wrong
- If `STRIPE_SECRET_KEY` is invalid, all API calls fail
- Check: Is the environment variable set correctly?

### 4. Currency/Amount Issues
- If `currency` is invalid or `unit_amount` is 0, Stripe will reject it
- Check: Are `bill.currency` and `bill.amountCents` valid?

## Test Endpoints Created

I've created test endpoints to verify Stripe works:

1. **`GET /api/test-stripe`** - Test minimal checkout (no customer)
2. **`GET /api/test-stripe?customer=cus_xxx`** - Test with customer ID

These will show you exactly what Stripe returns and any errors.

## Next Steps

1. **Test the minimal endpoint**: `GET /api/test-stripe`
   - If this works → Stripe API is fine, issue is with customer/company data
   - If this fails → Stripe API key or configuration issue

2. **Test with your customer ID**: `GET /api/test-stripe?customer=cus_TsAEnGO0GKyYK6`
   - If this works → Customer ID is valid, issue is elsewhere
   - If this fails → Customer ID doesn't exist in Stripe

3. **Check server logs** when loading bill page:
   - Look for `[STRIPE_CHECKOUT]` logs
   - Check if `getOrCreateStripeCustomer()` succeeds
   - Check if `stripe.checkout.sessions.create()` succeeds
