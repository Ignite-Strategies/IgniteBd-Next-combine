# Get Stripe Product ID Without Checkout

**Date:** 2025-01-28  
**Purpose:** API endpoint to get Stripe product ID for a plan without initiating checkout

---

## 🎯 The Problem

You want to get the Stripe product ID for a plan **without** going through checkout. For example:
- Display product ID in UI
- Link to Stripe dashboard
- Verify product exists
- Debugging

---

## ✅ The Solution

**API Endpoint:** `GET /api/plans/[id]/stripe-product`

### Usage

```typescript
// Get Stripe product ID for a plan
const response = await fetch(`/api/plans/${planId}/stripe-product`);
const data = await response.json();

// Returns:
{
  success: true,
  planId: "plan_abc123",
  stripeProductId: "prod_xxxxx"
}
```

### What It Does

1. **Checks if plan has `stripeProductId`**
   - If yes → Returns existing ID
   - If no → Creates Stripe product/price, saves IDs, returns product ID

2. **Creates Stripe resources if needed**
   - Creates Stripe product
   - Creates Stripe price (if plan has amount/currency)
   - Saves both IDs to plan
   - Returns product ID

---

## 🔄 Flow

### Plan Already Has Product ID
```
GET /api/plans/plan_123/stripe-product
  ↓
Check plan.stripeProductId? YES ("prod_abc123")
  ↓
Return: { stripeProductId: "prod_abc123" }
```

### Plan Doesn't Have Product ID
```
GET /api/plans/plan_123/stripe-product
  ↓
Check plan.stripeProductId? NO (null)
  ↓
Create Stripe product via stripe.products.create()
  ↓
Create Stripe price via stripe.prices.create()
  ↓
Save IDs to plan: stripeProductId = "prod_abc123", stripePriceId = "price_xyz789"
  ↓
Return: { stripeProductId: "prod_abc123" }
```

---

## 📋 Implementation

**File:** `app/api/plans/[id]/stripe-product/route.ts`

```typescript
export async function GET(request, { params }) {
  const { id } = await params;
  
  // Get or create Stripe product ID
  const productId = await getOrCreateStripeProductId(id);
  
  return NextResponse.json({
    success: true,
    planId: id,
    stripeProductId: productId,
  });
}
```

**Helper Function:** `lib/stripe/plan.ts`

```typescript
export async function getOrCreateStripeProductId(planId: string): Promise<string> {
  const plan = await prisma.plans.findUnique({
    where: { id: planId },
    select: { stripeProductId: true },
  });

  // If exists, return it
  if (plan?.stripeProductId) {
    return plan.stripeProductId;
  }

  // Create product/price (will create both)
  const { productId } = await createStripeProductAndPrice(planId);
  return productId;
}
```

---

## 🎯 When Product/Price Are Created

### Option 1: On Plan Creation (✅ Current)
- **When:** Plan is created via `POST /api/plans`
- **What:** Creates Stripe product and price immediately
- **Result:** Plan has `stripeProductId` and `stripePriceId` from the start

### Option 2: On First API Call (Fallback)
- **When:** `GET /api/plans/[id]/stripe-product` is called
- **What:** Creates Stripe product/price if they don't exist
- **Result:** Plan gets Stripe IDs, ready for checkout

### Option 3: On First Checkout (Fallback)
- **When:** User clicks "Pay" and checkout session is created
- **What:** Creates Stripe product/price if they don't exist
- **Result:** Plan gets Stripe IDs, checkout proceeds

---

## ✅ Benefits

1. **Can get product ID without checkout** - Just call the API
2. **Product/price created on plan creation** - Ready immediately
3. **Fallback creation** - If creation fails, will create on first use
4. **No duplicates** - IDs are saved, reused for all checkouts

---

## 📝 Notes

- **Product ID** = Stable identifier for the product (name/description)
- **Price ID** = Specific to amount/currency/interval (can change if plan changes)
- **Both created together** - Product is required for price
- **IDs saved to plan** - Reused for all future checkouts

---

**Last Updated:** 2025-01-28

