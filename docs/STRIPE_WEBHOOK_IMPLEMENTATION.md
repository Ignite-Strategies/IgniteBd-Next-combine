# Stripe Webhook + Platform Access Implementation

**Date:** 2025-01-28  
**Status:** ✅ Implemented

---

## ✅ What Was Done

### 1. Schema Updates

#### Removed `isActive` from Plan
- ✅ Removed `isActive` boolean field
- ✅ Can infer active status from PlatformAccess records
- ✅ Removed index on `isActive`

#### Updated PlatformAccess Model
- ✅ Renamed `endsAt` → `endedAt` (matches spec)
- ✅ Updated enum: `ACTIVE`, `PAST_DUE`, `CANCELED` (removed `PAUSED`, `EXPIRED`)
- ✅ Added unique constraint: `@@unique([companyId, planId])` for upsert support
- ✅ Made `interval` nullable in Plan (for one-time payments)

### 2. Webhook Route Created

**File:** `app/api/stripe/webhook/route.ts`

**Endpoint:** `https://app.ignitegrowth.biz/api/stripe/webhook`

**Events Handled:**
- ✅ `checkout.session.completed` - One-time payments
- ✅ `invoice.paid` - Subscription payments
- ✅ `invoice.payment_failed` - Payment failures
- ✅ `customer.subscription.updated` - Subscription changes
- ✅ `customer.subscription.deleted` - Subscription cancellations

**Features:**
- ✅ Always returns 200 with `{ received: true }`
- ✅ Verifies Stripe signature
- ✅ Idempotent (safe to receive duplicates)
- ✅ Logs unhandled events

### 3. Stripe Service Utilities Created

#### Customer Service
**File:** `lib/stripe/customer.ts`
- ✅ `getOrCreateStripeCustomer()` - Gets or creates Stripe customer for CompanyHQ

#### Checkout Service
**File:** `lib/stripe/checkout.ts`
- ✅ `createCheckoutSession()` - Creates Stripe checkout session
- ✅ Supports both one-time (`payment`) and subscription (`subscription`) modes
- ✅ Handles embedded checkout UI

### 4. PlatformAccessService Updated

**File:** `lib/services/platformAccessService.js`
- ✅ Updated to use `endedAt` instead of `endsAt`
- ✅ Updated status enum values (`CANCELED` instead of `EXPIRED`)
- ✅ Updated `pauseAccess()` to use `PAST_DUE` instead of `PAUSED`
- ✅ Updated `getActiveAccess()` to handle null `endedAt` (lifetime access)

---

## 📋 Webhook Logic

### checkout.session.completed
- **One-time payment:** Creates/updates PlatformAccess with `status = ACTIVE`, no subscription ID
- **Subscription payment:** Handled by `invoice.paid` event

### invoice.paid
- Finds PlatformAccess by `stripeSubscriptionId`
- Sets `status = ACTIVE`
- Clears `endedAt`

### invoice.payment_failed
- Finds PlatformAccess by `stripeSubscriptionId`
- Sets `status = PAST_DUE`

### customer.subscription.updated
- Updates PlatformAccess status based on subscription status
- Handles `past_due`, `unpaid`, `canceled` states

### customer.subscription.deleted
- Sets `status = CANCELED`
- Sets `endedAt = now()`

---

## 🔒 Constraints Enforced

- ✅ `stripeCustomerId` → CompanyHQ only
- ✅ `stripeProductId` / `stripePriceId` → Plan only
- ✅ `stripeSubscriptionId` → PlatformAccess only
- ✅ No separate Price table
- ✅ No separate Subscription table
- ✅ Company-scoped access (not user-scoped)

---

## 🧠 Mental Model

```
Plan            = Contract package (price + interval)
CompanyHQ       = Payer identity (owns stripeCustomerId)
PlatformAccess  = Entitlement (source of truth for access)
```

**Flow:**
1. Stripe enforces billing time
2. PlatformAccess enforces access
3. Webhook syncs Stripe state → PlatformAccess state

---

## ✅ Success Criteria

- [x] Schema valid (Prisma validate passes)
- [x] Webhook route created
- [x] Stripe services created
- [x] PlatformAccessService updated
- [x] No `isActive` field (inferred from PlatformAccess)
- [x] Correct enum values (ACTIVE, PAST_DUE, CANCELED)
- [x] Unique constraint for upsert support

---

## 🚀 Next Steps

1. **Run Migration:**
   ```bash
   npx prisma migrate dev --name add_platform_access_models
   ```

2. **Test Webhook:**
   - Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   - Test events: `stripe trigger checkout.session.completed`

3. **Seed Plans:**
   - Create initial plans via seed script or admin UI
   - Set `stripeProductId` and `stripePriceId` from Stripe

4. **Platform Manager Integration:**
   - Platform manager will set rates (for now, seed them)
   - Create Plans via platform manager UI

---

## 📝 Notes

- **Plans are immutable:** Price or interval change = new Plan row
- **Billing identity is company-scoped:** `stripeCustomerId` on CompanyHQ
- **Access is entitlement-scoped:** PlatformAccess is source of truth
- **Stripe enforces billing:** PlatformAccess enforces access
- **No overbuild:** Minimal models, no extra abstractions
- **Always return 200:** Webhook must always return success to Stripe

---

## 🔗 Related Files

- `prisma/schema.prisma` - Updated models
- `app/api/stripe/webhook/route.ts` - Webhook handler
- `lib/stripe/customer.ts` - Customer service
- `lib/stripe/checkout.ts` - Checkout service
- `lib/services/platformAccessService.js` - Access service (updated)

