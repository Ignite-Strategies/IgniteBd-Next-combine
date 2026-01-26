# Stripe Integration - Plans & Billing

**Date:** 2025-01-28  
**Purpose:** Document Stripe integration for plan-based billing system

---

## 🎯 Overview

Plans in IgniteBD use Stripe for payment processing. This document explains:
- How Stripe products and prices relate to plans
- When to create Stripe resources
- How to infer product/price IDs
- Stripe checkout flow

---

## 📊 Stripe Resources

### 1. Stripe Product (`stripeProductId`)
- **What it is:** A product in Stripe (e.g., "Gold Tier Plan")
- **Stripe ID format:** `prod_xxxxx`
- **When created:** Can be created when plan is created, or inferred later
- **Stored in:** `plans.stripeProductId`

### 2. Stripe Price (`stripePriceId`)
- **What it is:** A price for a product (amount + interval)
- **Stripe ID format:** `price_xxxxx`
- **When created:** Created when plan is created (if interval exists)
- **Stored in:** `plans.stripePriceId` (unique - 1:1 with plan)

### 3. Stripe Customer (`stripeCustomerId`)
- **What it is:** A customer in Stripe (represents a company)
- **Stripe ID format:** `cus_xxxxx`
- **When created:** Created on first checkout (or can be pre-created)
- **Stored in:** `company_hqs.stripeCustomerId`

### 4. Stripe Subscription (`stripeSubscriptionId`)
- **What it is:** An active subscription (for recurring plans)
- **Stripe ID format:** `sub_xxxxx`
- **When created:** Created by Stripe when checkout completes (recurring plans)
- **Stored in:** `company_hqs.stripeSubscriptionId`

---

## 🔄 Plan Creation Flow

### Option 1: Create Stripe Resources Immediately
**When:** Plan is created in IgniteBD

```typescript
// 1. Create Stripe Product
const product = await stripe.products.create({
  name: plan.name,
  description: plan.description || undefined,
});

// 2. Create Stripe Price (if recurring)
if (plan.interval) {
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.amountCents,
    currency: plan.currency.toLowerCase(),
    recurring: {
      interval: plan.interval.toLowerCase(), // 'month' or 'year'
    },
  });
  
  // Store both IDs
  plan.stripeProductId = product.id;
  plan.stripePriceId = price.id;
} else {
  // One-time payment - only product, no price yet
  plan.stripeProductId = product.id;
}
```

**Pros:**
- ✅ Stripe resources exist immediately
- ✅ Can use `stripePriceId` in checkout (faster)
- ✅ Plan is "ready" for checkout

**Cons:**
- ❌ Creates Stripe resources even if plan is never used
- ❌ More API calls during plan creation

### Option 2: Infer Stripe Resources on Checkout (Current)
**When:** First time plan is used for checkout

```typescript
// In createCheckoutSession()
if (plan.stripePriceId) {
  // Use existing price
  line_items: [{ price: plan.stripePriceId, quantity: 1 }]
} else {
  // Create price_data on the fly
  line_items: [{
    price_data: {
      currency: plan.currency,
      product_data: { name: plan.name },
      unit_amount: plan.amountCents,
      ...(plan.interval && {
        recurring: { interval: plan.interval.toLowerCase() }
      }),
    },
    quantity: 1,
  }]
  
  // Optionally: Create Stripe product/price and save to plan
  // (for future use)
}
```

**Pros:**
- ✅ Lazy creation - only creates when needed
- ✅ Faster plan creation
- ✅ No unused Stripe resources

**Cons:**
- ❌ Checkout is slightly slower (creates resources on first use)
- ❌ Need to handle product/price creation in checkout flow

---

## 🎯 Recommended Approach: Hybrid

### Plan Creation
1. **Create plan in database** (no Stripe resources yet)
2. **Stripe resources are inferred** on first checkout
3. **After checkout, save Stripe IDs** to plan for future use

### Implementation

```typescript
// When creating plan
const plan = await prisma.plans.create({
  data: {
    name: "Gold Tier - Monthly",
    description: "Premium features",
    amountCents: 50000, // $500
    currency: "usd",
    interval: "MONTH",
    // stripeProductId: null (created later)
    // stripePriceId: null (created later)
  },
});

// On first checkout
async function createCheckoutSession(plan, company) {
  let priceId = plan.stripePriceId;
  
  // If no price ID, create Stripe resources
  if (!priceId) {
    // Create product
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description || undefined,
    });
    
    // Create price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amountCents,
      currency: plan.currency.toLowerCase(),
      recurring: {
        interval: plan.interval.toLowerCase(),
      },
    });
    
    // Save to plan for future use
    await prisma.plans.update({
      where: { id: plan.id },
      data: {
        stripeProductId: product.id,
        stripePriceId: price.id,
      },
    });
    
    priceId = price.id;
  }
  
  // Use price ID in checkout
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: company.stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // ...
  });
}
```

---

## 📋 Stripe Product/Price Shape

### Stripe Product
```typescript
{
  id: "prod_xxxxx",           // Stripe product ID
  name: "Gold Tier Plan",     // Product name
  description: "Premium...",  // Optional description
  active: true,               // Whether product is active
  metadata: {},               // Custom metadata
  created: 1234567890,        // Unix timestamp
}
```

### Stripe Price
```typescript
{
  id: "price_xxxxx",          // Stripe price ID
  product: "prod_xxxxx",      // Product ID
  active: true,              // Whether price is active
  currency: "usd",           // Currency (lowercase)
  unit_amount: 50000,        // Amount in cents
  recurring: {
    interval: "month",        // 'month' or 'year'
    interval_count: 1,       // How many intervals
  },
  metadata: {},              // Custom metadata
  created: 1234567890,       // Unix timestamp
}
```

### One-Time Payment (No Recurring)
```typescript
{
  id: "price_xxxxx",
  product: "prod_xxxxx",
  active: true,
  currency: "usd",
  unit_amount: 50000,
  // No 'recurring' field = one-time payment
}
```

---

## 🔄 Checkout Flow

### For Recurring Plans (Subscription)
```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',              // Required for recurring
  customer: company.stripeCustomerId,
  line_items: [{
    price: plan.stripePriceId,      // Use price ID (faster)
    quantity: 1,
  }],
  success_url: '...',
  metadata: {
    companyHQId: company.id,
    planId: plan.id,
  },
});
```

### For One-Time Payments
```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'payment',                   // Required for one-time
  customer: company.stripeCustomerId,
  line_items: [{
    price_data: {                    // Create price on the fly
      currency: plan.currency,
      product_data: { name: plan.name },
      unit_amount: plan.amountCents,
      // No 'recurring' = one-time
    },
    quantity: 1,
  }],
  success_url: '...',
  metadata: {
    companyHQId: company.id,
    planId: plan.id,
  },
});
```

---

## 🎯 Plan Model Fields

```prisma
model plans {
  id              String        @id @default(cuid())
  name            String        // "Gold Tier - Monthly"
  description     String?       // Optional description
  amountCents     Int           // 50000 ($500.00)
  currency        String        @default("usd")
  interval        PlanInterval? // "MONTH" | "YEAR" | null
  
  // Stripe IDs (optional - inferred on first use)
  stripeProductId String?       // prod_xxxxx
  stripePriceId   String?       @unique // price_xxxxx
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  company_hqs     company_hqs[]
}
```

---

## ✅ Best Practices

1. **Create Stripe resources lazily** (on first checkout)
2. **Save Stripe IDs after creation** (for future use)
3. **Use `stripePriceId` in checkout** (if exists, faster)
4. **Fall back to `price_data`** (if no price ID yet)
5. **Handle both recurring and one-time** plans
6. **Store product ID even if no price** (for one-time plans)

---

## 🔗 Related Documents

- `PAYMENT_MANAGEMENT_SYSTEM_REFACTOR.md` - Overall payment system
- `CHECKOUT_UX_FLOW.md` - Checkout flow documentation
- `STRIPE_PAYLOAD_FIELDS.md` - Stripe payload requirements

---

**Last Updated:** 2025-01-28

