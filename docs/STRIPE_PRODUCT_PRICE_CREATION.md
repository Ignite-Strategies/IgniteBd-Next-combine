# Stripe Product/Price Creation - Who Creates What?

**Date:** 2025-01-28  
**Purpose:** Freeze frame on Stripe product/price creation - who creates them and when?

---

## 🎯 The Answer

**WE create the Stripe product/price IDs** (our code calls Stripe API).  
**Stripe assigns the IDs** (Stripe returns `prod_xxxxx` and `price_xxxxx`).

---

## 📊 Current State vs. Intended State

### Current Implementation (❌ Not Following Best Practice)

**File:** `lib/stripe/checkout.ts`

```typescript
// CURRENT: Creates product/price IMPLICITLY via price_data
const lineItems = [{
  price_data: {                    // ← Stripe creates product/price on the fly
    currency: plan.currency,
    product_data: { name: plan.name },
    unit_amount: plan.amountCents,
    recurring: { interval: 'month' },
  },
  quantity: 1,
}];

// Problem: Stripe creates product/price but we don't save the IDs!
// Result: Every checkout creates new product/price in Stripe
// Result: plan.stripeProductId and plan.stripePriceId stay null
```

**What happens:**
1. User clicks "Pay"
2. Checkout session created with `price_data`
3. Stripe creates product and price **implicitly** (we don't get the IDs)
4. Payment goes through
5. **We never save the product/price IDs to our plan**
6. Next checkout creates **new** product/price in Stripe (duplicates!)

---

### Intended Implementation (✅ Best Practice)

**We should explicitly create product/price and save IDs:**

```typescript
// INTENDED: Create product/price EXPLICITLY, save IDs
async function createCheckoutSession(plan, company) {
  let priceId = plan.stripePriceId;
  
  // If no price ID exists, create Stripe resources
  if (!priceId) {
    // 1. WE create Stripe Product (our code calls Stripe API)
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description || undefined,
    });
    // Stripe returns: { id: "prod_xxxxx", ... }
    
    // 2. WE create Stripe Price (our code calls Stripe API)
    const price = await stripe.prices.create({
      product: product.id,              // Link to product we just created
      unit_amount: plan.amountCents,
      currency: plan.currency.toLowerCase(),
      recurring: {
        interval: plan.interval.toLowerCase(),
      },
    });
    // Stripe returns: { id: "price_xxxxx", ... }
    
    // 3. WE save the IDs to our plan (so we can reuse them)
    await prisma.plans.update({
      where: { id: plan.id },
      data: {
        stripeProductId: product.id,   // Save product ID
        stripePriceId: price.id,       // Save price ID
      },
    });
    
    priceId = price.id;
  }
  
  // 4. Use the price ID in checkout (faster, cleaner)
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: company.stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],  // Use price ID, not price_data
    // ...
  });
}
```

**What happens:**
1. User clicks "Pay"
2. Check if `plan.stripePriceId` exists
3. If not, **WE create** product and price via Stripe API
4. **WE save** the IDs to `plan.stripeProductId` and `plan.stripePriceId`
5. Use `price: priceId` in checkout (faster than `price_data`)
6. Payment goes through
7. **Next checkout reuses the same product/price** (no duplicates!)

---

## 🔄 Who Does What?

### We (Our Code) Do:
1. ✅ **Create** Stripe product via `stripe.products.create()`
2. ✅ **Create** Stripe price via `stripe.prices.create()`
3. ✅ **Save** the returned IDs to `plan.stripeProductId` and `plan.stripePriceId`
4. ✅ **Use** the price ID in checkout sessions

### Stripe Does:
1. ✅ **Assigns** the IDs (`prod_xxxxx`, `price_xxxxx`)
2. ✅ **Stores** the product/price in their system
3. ✅ **Returns** the IDs to us in the API response

### We DON'T Do (Currently):
- ❌ Create product/price explicitly (we use `price_data` instead)
- ❌ Save the IDs to our plan (they stay null)
- ❌ Reuse existing product/price (creates duplicates)

---

## 🎯 The Flow

### Plan Creation (No Stripe Yet)
```
SuperAdmin creates plan
  ↓
plans.create({
  name: "Gold Tier",
  amountCents: 50000,
  interval: "MONTH",
  stripeProductId: null,    // ← Not created yet
  stripePriceId: null,      // ← Not created yet
})
```

### First Checkout (Create Stripe Resources)
```
User clicks "Pay"
  ↓
Check if plan.stripePriceId exists? NO
  ↓
WE call: stripe.products.create({ name: "Gold Tier" })
  ↓
Stripe returns: { id: "prod_abc123" }
  ↓
WE call: stripe.prices.create({ product: "prod_abc123", ... })
  ↓
Stripe returns: { id: "price_xyz789" }
  ↓
WE save: plan.stripeProductId = "prod_abc123"
        plan.stripePriceId = "price_xyz789"
  ↓
WE use: line_items: [{ price: "price_xyz789", quantity: 1 }]
  ↓
Stripe creates checkout session
```

### Subsequent Checkouts (Reuse Stripe Resources)
```
User clicks "Pay"
  ↓
Check if plan.stripePriceId exists? YES ("price_xyz789")
  ↓
WE use: line_items: [{ price: "price_xyz789", quantity: 1 }]
  ↓
Stripe creates checkout session (faster, no API calls needed)
```

---

## ⚠️ Current Problem

**Current code in `lib/stripe/checkout.ts`:**
- Uses `price_data` (Stripe creates product/price implicitly)
- Never saves IDs to plan
- Creates duplicate products/prices in Stripe for every checkout

**Fix needed:**
- Check if `plan.stripePriceId` exists
- If not, create product/price explicitly
- Save IDs to plan
- Use `price: priceId` instead of `price_data`

---

## 📋 Stripe API Calls

### Create Product
```typescript
const product = await stripe.products.create({
  name: "Gold Tier - Monthly",
  description: "Premium features",  // Optional
});

// Stripe returns:
{
  id: "prod_abc123",           // ← Stripe assigns this
  name: "Gold Tier - Monthly",
  description: "Premium features",
  active: true,
  created: 1234567890,
}
```

### Create Price
```typescript
const price = await stripe.prices.create({
  product: "prod_abc123",       // ← Link to product we created
  unit_amount: 50000,           // Amount in cents
  currency: "usd",              // Lowercase
  recurring: {
    interval: "month",          // 'month' or 'year'
  },
});

// Stripe returns:
{
  id: "price_xyz789",           // ← Stripe assigns this
  product: "prod_abc123",       // Links back to product
  unit_amount: 50000,
  currency: "usd",
  recurring: {
    interval: "month",
  },
  active: true,
  created: 1234567890,
}
```

---

## ✅ Best Practice Summary

1. **WE create** Stripe product/price (explicit API calls)
2. **Stripe assigns** the IDs (returns them in response)
3. **WE save** the IDs to our plan (for reuse)
4. **WE use** the price ID in checkout (not `price_data`)

**Benefits:**
- ✅ No duplicate products/prices in Stripe
- ✅ Faster checkout (reuse existing price)
- ✅ Better tracking (can see product/price in Stripe dashboard)
- ✅ Can manage products/prices in Stripe if needed

---

## 🔧 Implementation Fix Needed

**File:** `lib/stripe/checkout.ts`

**Current:**
```typescript
// Uses price_data (creates implicitly, doesn't save IDs)
lineItems: [{
  price_data: { ... }
}]
```

**Should be:**
```typescript
// Check if price ID exists, create if not, save IDs, use price ID
let priceId = plan.stripePriceId;

if (!priceId) {
  // Create product
  const product = await stripe.products.create({ ... });
  
  // Create price
  const price = await stripe.prices.create({ ... });
  
  // Save IDs to plan
  await prisma.plans.update({
    where: { id: plan.id },
    data: {
      stripeProductId: product.id,
      stripePriceId: price.id,
    },
  });
  
  priceId = price.id;
}

// Use price ID
lineItems: [{ price: priceId, quantity: 1 }]
```

---

**Last Updated:** 2025-01-28

