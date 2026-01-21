# Plan Mental Model

**Date:** 2025-01-31

---

## 🎯 Mental Model

### 1. Platform-Manager (Sets Pricing)

**Role:** Super admin creates Plans (pricing definitions)

**Plan Model:**
```prisma
model plans {
  id                String
  name              String
  description       String?
  interval          PlanInterval?  // MONTH, YEAR, or null (one-time)
  amountCents       Int
  currency          String
  stripeProductId   String?        // Optional - set later
  stripePriceId     String?        // Optional - set later
  // NO Stripe subscription fields here
  // NO access status here
}
```

**What Platform-Manager Does:**
- Creates Plan (pricing shape)
- Surfaces available plans to owners
- No Stripe subscription logic
- Just pricing definitions

---

### 2. IgniteBd-Next-combine (Selects & Stores)

**Role:** Owner selects plan → writes to company_hqs

**company_hqs Fields:**
```prisma
model company_hqs {
  // ... existing fields
  planId                String  // REQUIRED FK → Plan.id (not optional)
  planStatus            PlatformAccessStatus?  // ACTIVE, PAST_DUE, CANCELED
  stripeSubscriptionId  String?  // Set after Stripe checkout
  planStartedAt         DateTime?
  planEndedAt           DateTime?
  plans                 plans   @relation(...)
}
```

**Flow:**
1. Owner views available plans (GET /api/plans)
2. Owner selects plan
3. **Writes planId to company_hqs** (required - must have a plan)
4. When Stripe checkout happens:
   - Reads planId from company_hqs
   - Gets pricing from Plan (amountCents, currency, interval)
   - Creates Stripe checkout session
   - After payment: stores stripeSubscriptionId on company_hqs

---

## 🔄 Complete Flow

```
1. Super Admin (Platform-Manager)
   → Creates Plan
   → Plan stored in IgniteBd-Next-combine database
   → Plan has: name, amountCents, interval, currency
   → NO Stripe subscription fields

2. Owner (IgniteBd-Next-combine)
   → Views available plans (GET /api/plans)
   → Selects plan
   → POST /api/platform-access (or direct company_hqs update)
   → planId written to company_hqs (REQUIRED)

3. Stripe Checkout (IgniteBd-Next-combine)
   → Reads company_hqs.planId
   → Gets Plan details (amountCents, currency, interval)
   → Creates Stripe checkout session
   → After payment: stores stripeSubscriptionId on company_hqs
   → Updates planStatus = ACTIVE
```

---

## ✅ Key Points

1. **Plan = Pricing Definition** (shared, no Stripe subscription)
2. **company_hqs.planId = REQUIRED** (company must have a plan)
3. **Stripe fields on company_hqs** (subscription ID, status, dates)
4. **Platform-manager** just creates Plans (pricing)
5. **IgniteBd-Next-combine** handles selection + Stripe checkout

---

## 📋 Schema Summary

**Plan (pricing shape):**
- `amountCents`, `interval`, `currency`
- `stripeProductId`, `stripePriceId` (optional, set when creating Stripe products)
- NO subscription fields

**company_hqs (access state):**
- `planId` (REQUIRED FK)
- `planStatus` (ACTIVE, PAST_DUE, CANCELED)
- `stripeSubscriptionId` (set after checkout)
- `planStartedAt`, `planEndedAt`

